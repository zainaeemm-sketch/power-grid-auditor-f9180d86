import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";
import { getDefaultCounterfactualSet } from "./counterfactual/defaults";
import { executeCounterfactual } from "./counterfactual/execute";
import type {
  CounterfactualActionRow,
  CounterfactualResultRow,
  CounterfactualSpec,
  CounterfactualWithResult,
} from "./counterfactual/types";
import type { StructuredAction } from "./simulation/types";

async function loadRunContext(supabase: any, runId: string) {
  const { data: run, error: runErr } = await supabase
    .from("runs")
    .select("id, case_name")
    .eq("id", runId)
    .single();
  if (runErr || !run) throw new Error(`Run not found: ${runErr?.message ?? "unknown"}`);

  const { data: parse } = await supabase
    .from("run_parse_results")
    .select("*")
    .eq("run_id", runId)
    .maybeSingle();

  const baseline: StructuredAction = {
    action_type: parse?.action_type ?? null,
    target_index: parse?.target_index ?? null,
    value: parse?.value ?? null,
    enabled: parse?.enabled ?? true,
  };
  return { run, baseline };
}

async function executeAndPersist(
  supabase: any,
  runId: string,
  caseName: string,
  baseline: StructuredAction,
  specs: CounterfactualSpec[],
): Promise<CounterfactualWithResult[]> {
  const out: CounterfactualWithResult[] = [];
  for (const spec of specs) {
    const { data: action, error: aErr } = await supabase
      .from("counterfactual_actions")
      .insert({
        run_id: runId,
        action_type: spec.action_type,
        target_index: spec.target_index,
        value: spec.value,
        description: spec.description,
        source: spec.source,
      })
      .select()
      .single();
    if (aErr || !action) continue;

    const outcome = executeCounterfactual(caseName, baseline, spec);
    const { data: result } = await supabase
      .from("counterfactual_results")
      .insert({ counterfactual_action_id: action.id, ...outcome })
      .select()
      .single();
    out.push({
      action: action as CounterfactualActionRow,
      result: (result as CounterfactualResultRow) ?? null,
    });
  }
  return out;
}

export const listCounterfactuals = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { runId: string }) => input)
  .handler(async ({ data, context }): Promise<{ items: CounterfactualWithResult[] }> => {
    const { supabase } = context as any;
    const { data: actions, error } = await supabase
      .from("counterfactual_actions")
      .select("*")
      .eq("run_id", data.runId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`Failed to list counterfactuals: ${error.message}`);

    const ids = (actions ?? []).map((a: any) => a.id);
    const byAction: Record<string, CounterfactualResultRow> = {};
    if (ids.length) {
      const { data: results } = await supabase
        .from("counterfactual_results")
        .select("*")
        .in("counterfactual_action_id", ids)
        .order("created_at", { ascending: false });
      for (const r of (results ?? []) as CounterfactualResultRow[]) {
        if (!byAction[r.counterfactual_action_id]) byAction[r.counterfactual_action_id] = r;
      }
    }
    const items: CounterfactualWithResult[] = (actions ?? []).map((a: any) => ({
      action: a as CounterfactualActionRow,
      result: byAction[a.id] ?? null,
    }));
    return { items };
  });

export const runDefaultCounterfactuals = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { runId: string }) => input)
  .handler(async ({ data, context }): Promise<{ items: CounterfactualWithResult[] }> => {
    const { supabase } = context as any;
    const { run, baseline } = await loadRunContext(supabase, data.runId);
    const specs = getDefaultCounterfactualSet(baseline);
    const items = await executeAndPersist(supabase, run.id, run.case_name, baseline, specs);
    return { items };
  });

export const addCustomCounterfactual = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: {
    runId: string;
    action_type: string;
    target_index: number | null;
    value: number | null;
    description?: string;
  }) => {
    if (!input.action_type || input.action_type.length > 64) {
      throw new Error("action_type required (≤64 chars)");
    }
    return input;
  })
  .handler(async ({ data, context }): Promise<{ item: CounterfactualWithResult | null }> => {
    const { supabase } = context as any;
    const { run, baseline } = await loadRunContext(supabase, data.runId);
    const spec: CounterfactualSpec = {
      action_type: data.action_type,
      target_index: data.target_index,
      value: data.value,
      description:
        data.description ??
        `${data.action_type}${data.target_index != null ? `[${data.target_index}]` : ""}=${data.value ?? "—"}`,
      source: "custom",
    };
    const items = await executeAndPersist(supabase, run.id, run.case_name, baseline, [spec]);
    return { item: items[0] ?? null };
  });

export interface BatchCounterfactualSummary {
  total_actions: number;
  total_runs: number;
  avg_optimality_gap: number | null;
  avg_decision_regret: number | null;
  best_action_type: string | null;
  worst_action_type: string | null;
  per_run: Array<{
    run_id: string;
    case_name: string;
    agent: string;
    avg_optimality_gap: number | null;
    avg_decision_regret: number | null;
    counterfactuals: number;
  }>;
  per_action: Array<{
    run_id: string;
    case_name: string;
    agent: string;
    counterfactual_action_type: string;
    description: string | null;
    counterfactual_improvement: number;
    baseline_improvement: number;
    optimality_gap: number;
    decision_regret: number;
    feasibility_change: string;
    status: string;
    failure_reason: string | null;
  }>;
}

/**
 * Synchronously execute default counterfactuals for every run in a batch and
 * compute aggregate metrics. Counterfactual evaluation is fast (in-Worker DC PF),
 * so a queue isn't required for typical batch sizes.
 */
export const runBatchCounterfactuals = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { batchId: string }) => input)
  .handler(async ({ data, context }): Promise<{ executed_runs: number; total_actions: number }> => {
    const { supabase } = context as any;
    const { data: links, error } = await supabase
      .from("batch_run_links")
      .select("run_id")
      .eq("batch_id", data.batchId);
    if (error) throw new Error(`Failed to load batch runs: ${error.message}`);

    let executedRuns = 0;
    let totalActions = 0;
    for (const link of (links ?? []) as Array<{ run_id: string }>) {
      try {
        const { run, baseline } = await loadRunContext(supabase, link.run_id);
        const specs = getDefaultCounterfactualSet(baseline);
        const items = await executeAndPersist(supabase, run.id, run.case_name, baseline, specs);
        executedRuns += 1;
        totalActions += items.length;
      } catch {
        // skip failing run, continue batch
      }
    }
    return { executed_runs: executedRuns, total_actions: totalActions };
  });

export const getBatchCounterfactualSummary = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { batchId: string }) => input)
  .handler(async ({ data, context }): Promise<BatchCounterfactualSummary> => {
    const { supabase } = context as any;
    const { data: links } = await supabase
      .from("batch_run_links")
      .select("run_id, case_name, agent")
      .eq("batch_id", data.batchId);

    const runMeta: Record<string, { case_name: string; agent: string }> = {};
    for (const l of (links ?? []) as any[]) {
      runMeta[l.run_id] = { case_name: l.case_name ?? "", agent: l.agent ?? "" };
    }
    const runIds = Object.keys(runMeta);
    if (!runIds.length) {
      return {
        total_actions: 0, total_runs: 0,
        avg_optimality_gap: null, avg_decision_regret: null,
        best_action_type: null, worst_action_type: null,
        per_run: [], per_action: [],
      };
    }

    const { data: actions } = await supabase
      .from("counterfactual_actions")
      .select("*")
      .in("run_id", runIds);
    const actionIds = (actions ?? []).map((a: any) => a.id);
    const actionById: Record<string, any> = {};
    for (const a of (actions ?? []) as any[]) actionById[a.id] = a;

    let results: any[] = [];
    if (actionIds.length) {
      const { data: r } = await supabase
        .from("counterfactual_results")
        .select("*")
        .in("counterfactual_action_id", actionIds);
      results = (r ?? []) as any[];
    }

    const per_action = results.map((r) => {
      const a = actionById[r.counterfactual_action_id];
      const meta = a ? runMeta[a.run_id] : { case_name: "", agent: "" };
      return {
        run_id: a?.run_id ?? "",
        case_name: meta?.case_name ?? "",
        agent: meta?.agent ?? "",
        counterfactual_action_type: r.counterfactual_action_type as string,
        description: a?.description ?? null,
        counterfactual_improvement: Number(r.counterfactual_improvement),
        baseline_improvement: Number(r.baseline_improvement),
        optimality_gap: Number(r.optimality_gap),
        decision_regret: Number(r.decision_regret),
        feasibility_change: r.feasibility_change as string,
        status: r.status as string,
        failure_reason: r.failure_reason as string | null,
      };
    });

    const perRunMap = new Map<string, { gaps: number[]; regrets: number[] }>();
    for (const row of per_action) {
      const e = perRunMap.get(row.run_id) ?? { gaps: [], regrets: [] };
      e.gaps.push(row.optimality_gap);
      e.regrets.push(row.decision_regret);
      perRunMap.set(row.run_id, e);
    }
    const per_run = Array.from(perRunMap.entries()).map(([run_id, e]) => ({
      run_id,
      case_name: runMeta[run_id]?.case_name ?? "",
      agent: runMeta[run_id]?.agent ?? "",
      avg_optimality_gap: e.gaps.length ? +(e.gaps.reduce((a, b) => a + b, 0) / e.gaps.length).toFixed(4) : null,
      avg_decision_regret: e.regrets.length ? +(e.regrets.reduce((a, b) => a + b, 0) / e.regrets.length).toFixed(4) : null,
      counterfactuals: e.gaps.length,
    }));

    const total = per_action.length;
    const avg_optimality_gap = total ? +(per_action.reduce((a, b) => a + b.optimality_gap, 0) / total).toFixed(4) : null;
    const avg_decision_regret = total ? +(per_action.reduce((a, b) => a + b.decision_regret, 0) / total).toFixed(4) : null;

    // best/worst by mean counterfactual_improvement per action_type
    const byType = new Map<string, { sum: number; n: number }>();
    for (const r of per_action) {
      const e = byType.get(r.counterfactual_action_type) ?? { sum: 0, n: 0 };
      e.sum += r.counterfactual_improvement;
      e.n += 1;
      byType.set(r.counterfactual_action_type, e);
    }
    let best_action_type: string | null = null;
    let worst_action_type: string | null = null;
    let bestMean = -Infinity;
    let worstMean = Infinity;
    for (const [t, e] of byType) {
      const mean = e.sum / e.n;
      if (mean > bestMean) { bestMean = mean; best_action_type = t; }
      if (mean < worstMean) { worstMean = mean; worst_action_type = t; }
    }

    return {
      total_actions: total,
      total_runs: per_run.length,
      avg_optimality_gap,
      avg_decision_regret,
      best_action_type,
      worst_action_type,
      per_run,
      per_action,
    };
  });
