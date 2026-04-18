import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";
import type { DecisionTrace, BatchTraceAnalytics, StageType, StageAggregate } from "@/types/trace";

export const getRunTraces = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { runId: string }) => input)
  .handler(async ({ data, context }): Promise<{ traces: DecisionTrace[] }> => {
    const { data: rows, error } = await context.supabase
      .from("decision_traces")
      .select("*")
      .eq("run_id", data.runId)
      .order("sequence", { ascending: true });
    if (error) throw new Error(`Failed to load traces: ${error.message}`);
    return { traces: (rows ?? []) as DecisionTrace[] };
  });

export const getBatchTraceAnalytics = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { batchId: string }) => input)
  .handler(async ({ data, context }): Promise<BatchTraceAnalytics> => {
    const { data: links, error: linkErr } = await context.supabase
      .from("batch_run_links")
      .select("run_id")
      .eq("batch_id", data.batchId);
    if (linkErr) throw new Error(`Failed to load batch links: ${linkErr.message}`);
    const runIds = (links ?? []).map((l: any) => l.run_id);
    if (runIds.length === 0) {
      return { total_traces: 0, total_runs: 0, most_common_failure_stage: null, per_stage: [] };
    }
    const { data: rows, error } = await context.supabase
      .from("decision_traces")
      .select("stage_type, status, execution_time_ms")
      .in("run_id", runIds);
    if (error) throw new Error(`Failed to load traces: ${error.message}`);

    const map = new Map<StageType, { total: number; failures: number; sum_ms: number }>();
    for (const r of (rows ?? []) as Array<{ stage_type: StageType; status: string; execution_time_ms: number }>) {
      const cur = map.get(r.stage_type) ?? { total: 0, failures: 0, sum_ms: 0 };
      cur.total += 1;
      if (r.status === "failure") cur.failures += 1;
      cur.sum_ms += r.execution_time_ms ?? 0;
      map.set(r.stage_type, cur);
    }
    const per_stage: StageAggregate[] = Array.from(map.entries()).map(([stage_type, v]) => ({
      stage_type,
      total: v.total,
      failures: v.failures,
      avg_time_ms: v.total > 0 ? Math.round(v.sum_ms / v.total) : 0,
    }));
    let most: StageType | null = null;
    let mostCount = 0;
    for (const s of per_stage) {
      if (s.failures > mostCount) {
        mostCount = s.failures;
        most = s.stage_type;
      }
    }
    return {
      total_traces: rows?.length ?? 0,
      total_runs: runIds.length,
      most_common_failure_stage: most,
      per_stage,
    };
  });
