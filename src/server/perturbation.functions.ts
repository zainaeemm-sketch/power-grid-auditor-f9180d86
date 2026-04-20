import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";
import { getDefaultPerturbationSet } from "./perturbation/defaults";
import { executePerturbation } from "./perturbation/execute";
import type {
  PerturbationSpec,
  PerturbationTestRow,
  PerturbationResultRow,
  PerturbationTestWithResult,
  PerturbationType,
} from "./perturbation/types";
import type { StructuredAction } from "./simulation/types";

const VALID_TYPES: PerturbationType[] = [
  "increase_load_percent",
  "decrease_load_percent",
  "line_outage",
  "line_restoration",
  "generator_limit_change",
  "generator_dispatch_change",
  "n1_contingency",
  "voltage_setpoint_shift",
];

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

  const action: StructuredAction = {
    action_type: parse?.action_type ?? null,
    target_index: parse?.target_index ?? null,
    value: parse?.value ?? null,
    enabled: parse?.enabled ?? true,
  };
  return { run, action };
}

async function executeAndPersist(
  supabase: any,
  runId: string,
  caseName: string,
  action: StructuredAction,
  specs: PerturbationSpec[],
): Promise<PerturbationTestWithResult[]> {
  const out: PerturbationTestWithResult[] = [];
  for (const spec of specs) {
    const { data: test, error: tErr } = await supabase
      .from("perturbation_tests")
      .insert({
        run_id: runId,
        perturbation_type: spec.perturbation_type,
        parameter_name: spec.parameter_name,
        parameter_value: spec.parameter_value,
        description: spec.description,
      })
      .select()
      .single();
    if (tErr || !test) continue;

    const outcome = await executePerturbation(caseName, action, spec);
    const { data: result } = await supabase
      .from("perturbation_results")
      .insert({ perturbation_test_id: test.id, ...outcome })
      .select()
      .single();

    out.push({ test: test as PerturbationTestRow, result: (result as PerturbationResultRow) ?? null });
  }
  return out;
}

export const listPerturbationTests = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { runId: string }) => input)
  .handler(async ({ data, context }): Promise<{ items: PerturbationTestWithResult[] }> => {
    const { supabase } = context as any;
    const { data: tests, error } = await supabase
      .from("perturbation_tests")
      .select("*")
      .eq("run_id", data.runId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`Failed to list perturbation tests: ${error.message}`);

    const ids = (tests ?? []).map((t: any) => t.id);
    let resultsByTest: Record<string, PerturbationResultRow> = {};
    if (ids.length) {
      const { data: results } = await supabase
        .from("perturbation_results")
        .select("*")
        .in("perturbation_test_id", ids)
        .order("created_at", { ascending: false });
      for (const r of (results ?? []) as PerturbationResultRow[]) {
        if (!resultsByTest[r.perturbation_test_id]) resultsByTest[r.perturbation_test_id] = r;
      }
    }

    const items: PerturbationTestWithResult[] = (tests ?? []).map((t: any) => ({
      test: t as PerturbationTestRow,
      result: resultsByTest[t.id] ?? null,
    }));
    return { items };
  });

export const runDefaultPerturbations = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { runId: string }) => input)
  .handler(async ({ data, context }): Promise<{ items: PerturbationTestWithResult[] }> => {
    const { supabase } = context as any;
    const { run, action } = await loadRunContext(supabase, data.runId);
    const items = await executeAndPersist(
      supabase,
      run.id,
      run.case_name,
      action,
      getDefaultPerturbationSet(),
    );
    return { items };
  });

export const addCustomPerturbation = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: {
    runId: string;
    perturbation_type: PerturbationType;
    parameter_name: string;
    parameter_value: number | null;
    description?: string;
  }) => {
    if (!VALID_TYPES.includes(input.perturbation_type)) {
      throw new Error(`Invalid perturbation_type: ${input.perturbation_type}`);
    }
    if (!input.parameter_name || input.parameter_name.length > 64) {
      throw new Error("parameter_name required (≤64 chars)");
    }
    return input;
  })
  .handler(async ({ data, context }): Promise<{ item: PerturbationTestWithResult | null }> => {
    const { supabase } = context as any;
    const { run, action } = await loadRunContext(supabase, data.runId);
    const spec: PerturbationSpec = {
      perturbation_type: data.perturbation_type,
      parameter_name: data.parameter_name,
      parameter_value: data.parameter_value,
      description: data.description ?? `${data.perturbation_type} ${data.parameter_name}=${data.parameter_value}`,
    };
    const items = await executeAndPersist(supabase, run.id, run.case_name, action, [spec]);
    return { item: items[0] ?? null };
  });

/**
 * Enqueue a `run_perturbation` job per linked run. The job_queue worker drain
 * (client polling + cron) executes them in the background.
 */
export const runBatchPerturbations = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { batchId: string }) => input)
  .handler(async ({ data, context }): Promise<{ enqueued: number; run_count: number }> => {
    const { supabase, userId } = context as any;
    const { data: links, error } = await supabase
      .from("batch_run_links")
      .select("run_id")
      .eq("batch_id", data.batchId);
    if (error) throw new Error(`Failed to load batch runs: ${error.message}`);

    const runIds = ((links ?? []) as Array<{ run_id: string }>).map((l) => l.run_id);
    let enqueued = 0;
    for (const runId of runIds) {
      const { error: jobErr } = await supabase.from("job_queue").insert({
        user_id: userId,
        job_type: "run_perturbation",
        payload: { run_id: runId, batch_id: data.batchId },
        priority: 0,
        max_attempts: 2,
      });
      if (!jobErr) enqueued += 1;
    }
    return { enqueued, run_count: runIds.length };
  });

export interface BatchPerturbationProgress {
  total: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  pending: number;
}

export const getBatchPerturbationProgress = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { batchId: string }) => input)
  .handler(async ({ data, context }): Promise<BatchPerturbationProgress> => {
    const { supabase, userId } = context as any;
    const { data: jobs, error } = await supabase
      .from("job_queue")
      .select("status, payload")
      .eq("user_id", userId)
      .eq("job_type", "run_perturbation");
    if (error) throw new Error(`Failed to load progress: ${error.message}`);

    const filtered = (jobs ?? []).filter(
      (j: any) => j.payload?.batch_id === data.batchId,
    );
    const counts = { total: filtered.length, queued: 0, running: 0, completed: 0, failed: 0 };
    for (const j of filtered) {
      if (j.status === "queued") counts.queued += 1;
      else if (j.status === "running") counts.running += 1;
      else if (j.status === "completed") counts.completed += 1;
      else if (j.status === "failed") counts.failed += 1;
    }
    return { ...counts, pending: counts.queued + counts.running };
  });

export interface BatchPerturbationJob {
  job_id: string;
  run_id: string;
  case_name: string | null;
  agent: string | null;
  status: string;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  execution_time_ms: number | null;
  created_at: string;
}

export const listBatchPerturbationJobs = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { batchId: string }) => input)
  .handler(async ({ data, context }): Promise<{ jobs: BatchPerturbationJob[] }> => {
    const { supabase, userId } = context as any;
    const { data: jobs, error } = await supabase
      .from("job_queue")
      .select("id, payload, status, attempts, max_attempts, error_message, started_at, completed_at, execution_time_ms, created_at")
      .eq("user_id", userId)
      .eq("job_type", "run_perturbation")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Failed to load jobs: ${error.message}`);

    const filtered = (jobs ?? []).filter((j: any) => j.payload?.batch_id === data.batchId);
    const runIds = Array.from(new Set(filtered.map((j: any) => j.payload?.run_id).filter(Boolean)));
    const meta: Record<string, { case_name: string | null; agent: string | null }> = {};
    if (runIds.length) {
      const { data: links } = await supabase
        .from("batch_run_links")
        .select("run_id, case_name, agent")
        .eq("batch_id", data.batchId)
        .in("run_id", runIds);
      for (const l of (links ?? []) as any[]) {
        meta[l.run_id] = { case_name: l.case_name ?? null, agent: l.agent ?? null };
      }
    }

    return {
      jobs: filtered.map((j: any) => ({
        job_id: j.id,
        run_id: j.payload?.run_id ?? "",
        case_name: meta[j.payload?.run_id]?.case_name ?? null,
        agent: meta[j.payload?.run_id]?.agent ?? null,
        status: j.status,
        attempts: j.attempts,
        max_attempts: j.max_attempts,
        error_message: j.error_message,
        started_at: j.started_at,
        completed_at: j.completed_at,
        execution_time_ms: j.execution_time_ms,
        created_at: j.created_at,
      })),
    };
  });

export const getPerturbationJobLogs = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { jobId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: logs, error } = await supabase
      .from("job_logs")
      .select("id, level, message, metadata, created_at")
      .eq("job_id", data.jobId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(`Failed to load logs: ${error.message}`);
    return { logs: logs ?? [] };
  });

export interface BatchRobustnessSummary {
  avg_robustness_score: number | null;
  failure_rate: number | null;
  worst_violation_change: number | null;
  most_sensitive_scenario: string | null;
  total_tests: number;
  per_run: Array<{
    run_id: string;
    case_name: string;
    agent: string;
    avg_score: number | null;
    failures: number;
    tests: number;
  }>;
  per_test: Array<{
    run_id: string;
    case_name: string;
    agent: string;
    perturbation_type: string;
    parameter_name: string;
    parameter_value: number | null;
    baseline_feasibility: string;
    perturbed_feasibility: string;
    violation_change: number;
    robustness_result: string;
    robustness_score: number;
    failure_reason: string | null;
  }>;
}

export const getBatchRobustnessSummary = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { batchId: string }) => input)
  .handler(async ({ data, context }): Promise<BatchRobustnessSummary> => {
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
        avg_robustness_score: null, failure_rate: null,
        worst_violation_change: null, most_sensitive_scenario: null,
        total_tests: 0, per_run: [], per_test: [],
      };
    }

    const { data: tests } = await supabase
      .from("perturbation_tests")
      .select("*")
      .in("run_id", runIds);
    const testIds = (tests ?? []).map((t: any) => t.id);
    const testById: Record<string, any> = {};
    for (const t of (tests ?? []) as any[]) testById[t.id] = t;

    let results: any[] = [];
    if (testIds.length) {
      const { data: r } = await supabase
        .from("perturbation_results")
        .select("*")
        .in("perturbation_test_id", testIds);
      results = (r ?? []) as any[];
    }

    const per_test = results.map((r) => {
      const t = testById[r.perturbation_test_id];
      const meta = t ? runMeta[t.run_id] : { case_name: "", agent: "" };
      return {
        run_id: t?.run_id ?? "",
        case_name: meta?.case_name ?? "",
        agent: meta?.agent ?? "",
        perturbation_type: t?.perturbation_type ?? "",
        parameter_name: t?.parameter_name ?? "",
        parameter_value: t?.parameter_value ?? null,
        baseline_feasibility: r.baseline_feasibility,
        perturbed_feasibility: r.perturbed_feasibility,
        violation_change: r.violation_change,
        robustness_result: r.robustness_result,
        robustness_score: Number(r.robustness_score),
        failure_reason: r.failure_reason,
      };
    });

    const perRunMap = new Map<string, { scores: number[]; failures: number; tests: number }>();
    for (const row of per_test) {
      const e = perRunMap.get(row.run_id) ?? { scores: [], failures: 0, tests: 0 };
      e.scores.push(row.robustness_score);
      if (row.robustness_result === "failed") e.failures += 1;
      e.tests += 1;
      perRunMap.set(row.run_id, e);
    }

    const per_run = Array.from(perRunMap.entries()).map(([run_id, e]) => ({
      run_id,
      case_name: runMeta[run_id]?.case_name ?? "",
      agent: runMeta[run_id]?.agent ?? "",
      avg_score: e.scores.length ? e.scores.reduce((a, b) => a + b, 0) / e.scores.length : null,
      failures: e.failures,
      tests: e.tests,
    }));

    const totalTests = per_test.length;
    const avg_robustness_score = totalTests
      ? per_test.reduce((a, b) => a + b.robustness_score, 0) / totalTests
      : null;
    const failure_rate = totalTests
      ? per_test.filter((r) => r.robustness_result === "failed").length / totalTests
      : null;
    const worst_violation_change = totalTests
      ? per_test.reduce((m, r) => (r.violation_change > m ? r.violation_change : m), -Infinity)
      : null;

    let most_sensitive_scenario: string | null = null;
    if (per_run.length) {
      const worst = per_run.reduce((a, b) => ((a.avg_score ?? 1) <= (b.avg_score ?? 1) ? a : b));
      most_sensitive_scenario = worst.case_name || worst.run_id;
    }

    return {
      avg_robustness_score,
      failure_rate,
      worst_violation_change: worst_violation_change === -Infinity ? null : worst_violation_change,
      most_sensitive_scenario,
      total_tests: totalTests,
      per_run,
      per_test,
    };
  });
