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
