import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";
import type { RunParseResult, RunEvaluation } from "@/types/grid-arena";
import { runSimulation } from "./simulation/engine";
import type { EvaluationMode, SimulationEngine, SimulationResult } from "./simulation/types";
import { maybeAutoJudge } from "./judge.functions";

interface ActionResult {
  action_applied: string;
  application_status: "success" | "failed" | "skipped";
  application_notes: string;
}

interface EvaluationFields {
  feasibility: string;
  violations_found: number;
  baseline_violations: number;
  post_action_violations: number;
  violation_improvement: number;
  confidence: string;
  grounding_quality: string;
  action_applied: string;
  notes: string;
  engine_used?: SimulationEngine;
  simulation_details?: any;
}

export function applyParsedAction(parseResult: RunParseResult | null): ActionResult {
  if (!parseResult || !parseResult.action_type || parseResult.action_type === "none" || !parseResult.enabled) {
    return {
      action_applied: "No action applied",
      application_status: "skipped",
      application_notes: "No valid structured action was parsed from the recommendation.",
    };
  }

  const { action_type, target_index, value } = parseResult;

  if (action_type === "scale_all_loads") {
    if (value == null || isNaN(value)) {
      return { action_applied: "No action applied", application_status: "failed", application_notes: "scale_all_loads action missing a valid scaling factor." };
    }
    return { action_applied: `Scaled all loads by factor ${value}`, application_status: "success", application_notes: `Load scaling applied with factor ${value}.` };
  }

  if (action_type === "set_generator_p_mw") {
    if (target_index == null || value == null || isNaN(value)) {
      return { action_applied: "No action applied", application_status: "failed", application_notes: "set_generator_p_mw action missing generator index or MW value." };
    }
    return { action_applied: `Set generator ${target_index} to ${value} MW`, application_status: "success", application_notes: `Generator ${target_index} dispatch set to ${value} MW.` };
  }

  if (action_type === "line_outage") {
    if (target_index == null) {
      return { action_applied: "No action applied", application_status: "failed", application_notes: "line_outage action missing target line index." };
    }
    return { action_applied: `Took line ${target_index} out of service`, application_status: "success", application_notes: `Line ${target_index} removed from service for contingency analysis.` };
  }

  return { action_applied: "No action applied", application_status: "failed", application_notes: `Unsupported action type: ${action_type}.` };
}

export function computeEvaluation(parseResult: RunParseResult | null, actionResult: ActionResult): EvaluationFields {
  const baseline = 10;
  let post = baseline;
  let improvement = 0;
  let feasibility = "not_applicable";
  let confidence = "low";
  let grounding = "ungrounded";

  if (actionResult.application_status === "success" && parseResult) {
    const { action_type, value, source_text } = parseResult;
    feasibility = "feasible";
    confidence = "high";
    if (source_text) grounding = "grounded";

    if (action_type === "scale_all_loads" && value != null) {
      if (value < 1) { improvement = 2; post = 8; }
      else { improvement = -1; post = 11; }
    } else if (action_type === "set_generator_p_mw") {
      improvement = 1; post = 9;
    } else if (action_type === "line_outage") {
      improvement = -3; post = 13;
    }
  } else if (actionResult.application_status === "failed") {
    feasibility = "infeasible";
    confidence = "medium";
    if (parseResult?.source_text) grounding = "grounded";
  }

  return {
    feasibility,
    violations_found: post,
    baseline_violations: baseline,
    post_action_violations: post,
    violation_improvement: improvement,
    confidence,
    grounding_quality: grounding,
    action_applied: actionResult.action_applied,
    notes: actionResult.application_notes,
    engine_used: "rule_based",
  };
}

/**
 * Combined evaluator: tries the simulation engine first (per the requested mode),
 * then falls back to the deterministic rule-based path. Always returns a complete
 * EvaluationFields result.
 */
export async function evaluateWithSimulation(
  parseResult: RunParseResult | null,
  caseName: string,
  mode: EvaluationMode,
): Promise<EvaluationFields> {
  const actionResult = applyParsedAction(parseResult);

  if (mode !== "rule_based" && parseResult && actionResult.application_status !== "failed") {
    const sim: SimulationResult | null = await runSimulation(
      caseName,
      {
        action_type: parseResult.action_type,
        target_index: parseResult.target_index,
        value: parseResult.value,
        enabled: parseResult.enabled,
      },
      mode,
    );

    if (sim) {
      const grounding = parseResult.source_text ? "grounded" : "ungrounded";
      return {
        feasibility: sim.feasibility,
        violations_found: sim.violations_found,
        baseline_violations: sim.baseline_violations,
        post_action_violations: sim.post_action_violations,
        violation_improvement: sim.violation_improvement,
        confidence: "high",
        grounding_quality: grounding,
        action_applied: actionResult.action_applied,
        notes: `${actionResult.application_notes} ${sim.notes}`.trim(),
        engine_used: sim.engine,
        simulation_details: {
          line_loadings: sim.line_loadings,
          voltage_violations: sim.voltage_violations,
          generator_violations: sim.generator_violations,
        },
      };
    }
    // simulation requested but unavailable → fall through to rule-based
  }

  return computeEvaluation(parseResult, actionResult);
}

export const evaluateRun = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { run_id: string }) => input)
  .handler(async ({ data, context }): Promise<{ evaluation: RunEvaluation | null }> => {
    const { supabase } = context;
    const runId = data.run_id;

    const { data: parseResult } = await (supabase as any)
      .from("run_parse_results")
      .select("*")
      .eq("run_id", runId)
      .maybeSingle();

    const { data: run } = await (supabase as any)
      .from("runs").select("case_name").eq("id", runId).single();
    const { data: meta } = await (supabase as any)
      .from("run_metadata").select("evaluation_mode").eq("run_id", runId).maybeSingle();
    const mode: EvaluationMode = (meta?.evaluation_mode as EvaluationMode) || "rule_based";

    const evalFields = await evaluateWithSimulation(
      parseResult as RunParseResult | null,
      run?.case_name ?? "",
      mode,
    );

    const { data: existing } = await (supabase as any)
      .from("run_evaluations")
      .select("id")
      .eq("run_id", runId)
      .maybeSingle();

    let evaluation: RunEvaluation | null = null;

    if (existing) {
      const { data: updated } = await (supabase as any)
        .from("run_evaluations")
        .update(evalFields)
        .eq("run_id", runId)
        .select("*")
        .single();
      evaluation = updated as RunEvaluation;
    } else {
      const { data: inserted } = await (supabase as any)
        .from("run_evaluations")
        .insert({ run_id: runId, ...evalFields })
        .select("*")
        .single();
      evaluation = inserted as RunEvaluation;
    }

    void maybeAutoJudge(supabase, context.userId, runId);
    return { evaluation };
  });

export const reparseAndEvaluate = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { run_id: string; recommendation_text: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { run_id, recommendation_text } = data;

    // Dynamic import to avoid circular dependency
    const { parseRecommendationText } = await import("./llm.functions");

    const parseResult = parseRecommendationText(recommendation_text);

    // Upsert parse result
    const { data: existingParse } = await (supabase as any)
      .from("run_parse_results")
      .select("id")
      .eq("run_id", run_id)
      .maybeSingle();

    if (existingParse) {
      await (supabase as any).from("run_parse_results").update(parseResult).eq("run_id", run_id);
    } else {
      await (supabase as any).from("run_parse_results").insert({ run_id, ...parseResult });
    }

    const { data: run } = await (supabase as any)
      .from("runs").select("case_name").eq("id", run_id).single();
    const { data: meta } = await (supabase as any)
      .from("run_metadata").select("evaluation_mode").eq("run_id", run_id).maybeSingle();
    const mode: EvaluationMode = (meta?.evaluation_mode as EvaluationMode) || "rule_based";

    const fullParseResult = { ...parseResult, id: "", run_id, created_at: "", updated_at: "" } as RunParseResult;
    const evalFields = await evaluateWithSimulation(fullParseResult, run?.case_name ?? "", mode);

    const { data: existingEval } = await (supabase as any)
      .from("run_evaluations")
      .select("id")
      .eq("run_id", run_id)
      .maybeSingle();

    if (existingEval) {
      await (supabase as any).from("run_evaluations").update(evalFields).eq("run_id", run_id);
    } else {
      await (supabase as any).from("run_evaluations").insert({ run_id, ...evalFields });
    }

    void maybeAutoJudge(supabase, context.userId, run_id);
    return { success: true, parseResult, evaluation: evalFields };
  });

/**
 * Backfill missing or incomplete evaluation metrics for existing completed runs.
 * Targets the four readiness fields used by the dashboard charts:
 *   - violation_improvement
 *   - feasibility (excluding "unknown")
 *   - confidence + grounding_quality
 *   - case-level performance (requires runs.case_name + violation_improvement)
 *
 * A run is considered missing metrics when:
 *   - it has no run_evaluations row, OR
 *   - feasibility is null/"unknown", OR
 *   - violation_improvement is null, OR
 *   - confidence or grounding_quality is null
 *
 * Optionally scope to a single batch via batch_id. Returns per-run results so
 * the caller can show exactly which runs were updated and which still cannot
 * be evaluated (e.g. no parsed action).
 */
export const backfillEvaluations = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { batch_id?: string; limit?: number; force?: boolean }) => ({
    batch_id: input.batch_id,
    limit: Math.min(Math.max(input.limit ?? 200, 1), 500),
    force: !!input.force,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Determine candidate run IDs (scoped to batch if requested).
    let runIds: string[] = [];
    if (data.batch_id) {
      const { data: links } = await (supabase as any)
        .from("batch_run_links")
        .select("run_id")
        .eq("batch_id", data.batch_id);
      runIds = (links ?? []).map((l: { run_id: string }) => l.run_id);
    } else {
      const { data: runs } = await (supabase as any)
        .from("runs")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(data.limit);
      runIds = (runs ?? []).map((r: { id: string }) => r.id);
    }

    if (runIds.length === 0) {
      return { scanned: 0, candidates: 0, updated: 0, skipped: 0, results: [] as Array<{
        run_id: string; status: "updated" | "skipped" | "error"; reason?: string;
      }> };
    }

    // 2. Pull run + metadata + parse_result + existing evaluation in bulk.
    const [{ data: runs }, { data: metas }, { data: parses }, { data: evals }] = await Promise.all([
      (supabase as any).from("runs").select("id,case_name,status").in("id", runIds),
      (supabase as any).from("run_metadata").select("run_id,evaluation_mode").in("run_id", runIds),
      (supabase as any).from("run_parse_results").select("*").in("run_id", runIds),
      (supabase as any).from("run_evaluations").select("*").in("run_id", runIds),
    ]);

    const runMap = new Map<string, { case_name: string; status: string }>();
    for (const r of runs ?? []) runMap.set(r.id, { case_name: r.case_name, status: r.status });
    const metaMap = new Map<string, string>();
    for (const m of metas ?? []) metaMap.set(m.run_id, m.evaluation_mode ?? "rule_based");
    const parseMap = new Map<string, RunParseResult>();
    for (const p of parses ?? []) parseMap.set(p.run_id, p as RunParseResult);
    const evalMap = new Map<string, RunEvaluation>();
    for (const e of evals ?? []) evalMap.set(e.run_id, e as RunEvaluation);

    const isIncomplete = (e: RunEvaluation | undefined): boolean => {
      if (!e) return true;
      if (!e.feasibility || e.feasibility === "unknown") return true;
      if (e.violation_improvement === null || e.violation_improvement === undefined) return true;
      if (!e.confidence) return true;
      if (!e.grounding_quality) return true;
      return false;
    };

    const results: Array<{ run_id: string; status: "updated" | "skipped" | "error"; reason?: string }> = [];
    let updated = 0;
    let skipped = 0;

    // 3. Recompute for each candidate (sequential to avoid hammering the simulator).
    for (const runId of runIds) {
      const run = runMap.get(runId);
      if (!run) {
        results.push({ run_id: runId, status: "skipped", reason: "run not found" });
        skipped++;
        continue;
      }
      if (run.status !== "completed") {
        results.push({ run_id: runId, status: "skipped", reason: `status=${run.status}` });
        skipped++;
        continue;
      }
      const existing = evalMap.get(runId);
      if (!data.force && !isIncomplete(existing)) {
        results.push({ run_id: runId, status: "skipped", reason: "already complete" });
        skipped++;
        continue;
      }

      const parseResult = parseMap.get(runId) ?? null;
      const mode = (metaMap.get(runId) as EvaluationMode) || "rule_based";

      try {
        const evalFields = await evaluateWithSimulation(parseResult, run.case_name ?? "", mode);

        if (existing) {
          await (supabase as any).from("run_evaluations").update(evalFields).eq("run_id", runId);
        } else {
          await (supabase as any).from("run_evaluations").insert({ run_id: runId, ...evalFields });
        }
        results.push({ run_id: runId, status: "updated" });
        updated++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ run_id: runId, status: "error", reason: msg });
      }
    }

    return {
      scanned: runIds.length,
      candidates: runIds.filter((id) => data.force || isIncomplete(evalMap.get(id))).length,
      updated,
      skipped,
      results,
    };
  });
