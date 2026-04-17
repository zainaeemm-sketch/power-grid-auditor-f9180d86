import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";
import { runWithConcurrency } from "@/lib/server-utils";
import type { JobRecord } from "./types";

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_BATCH = 5;

async function logInternal(supabase: any, jobId: string, userId: string, level: string, message: string, metadata?: any) {
  try {
    await supabase.from("job_logs").insert({
      job_id: jobId, user_id: userId, level, message: message.slice(0, 2000), metadata: metadata ?? null,
    });
  } catch (err) {
    console.error("log error", err);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }).catch((e) => { clearTimeout(t); reject(e); });
  });
}

async function dispatchJob(supabase: any, userId: string, job: JobRecord, timeoutMs: number) {
  const start = Date.now();
  await logInternal(supabase, job.id, userId, "info", `Dispatching ${job.job_type} (attempt ${job.attempts})`);

  if (job.job_type === "run_execution") {
    const runId = job.payload?.run_id as string | undefined;
    if (!runId) throw new Error("Missing run_id in payload");
    const { executeRunLlm } = await import("../llm.functions");
    const res = await withTimeout(executeRunLlm({ data: { run_id: runId } }), timeoutMs, "executeRunLlm");
    if (!res.success) throw new Error(res.error ?? "Run execution failed");
    return { duration_ms: Date.now() - start };
  }

  throw new Error(`Unknown job_type: ${job.job_type}`);
}

export const processJobBatch = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { limit?: number; timeout_ms?: number; lease_seconds?: number } = {}) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const limit = Math.min(data?.limit ?? 3, MAX_BATCH);
    const timeoutMs = data?.timeout_ms ?? DEFAULT_TIMEOUT_MS;
    const leaseSeconds = data?.lease_seconds ?? 60;
    const workerId = `w_${Math.random().toString(36).slice(2, 10)}`;
    const totalStart = Date.now();

    const { data: claimed, error: claimErr } = await (supabase as any).rpc("claim_jobs", {
      p_user_id: userId,
      p_limit: limit,
      p_lease_seconds: leaseSeconds,
      p_worker_id: workerId,
    });

    if (claimErr) throw new Error(`Claim failed: ${claimErr.message}`);
    const jobs = (claimed ?? []) as JobRecord[];
    if (jobs.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0, duration_ms: Date.now() - totalStart };
    }

    const settled = await runWithConcurrency(jobs, async (job) => {
      try {
        const r = await dispatchJob(supabase, userId, job, timeoutMs);
        await (supabase as any).from("job_queue").update({
          status: "completed",
          completed_at: new Date().toISOString(),
          execution_time_ms: r.duration_ms,
          error_message: null,
        }).eq("id", job.id);
        await logInternal(supabase, job.id, userId, "metric", "Job completed", { duration_ms: r.duration_ms });
        return { id: job.id, ok: true };
      } catch (err: any) {
        const msg = (err?.message ?? String(err)).slice(0, 1000);
        const stack = (err?.stack ?? "").slice(0, 1000);
        const finalAttempt = job.attempts >= job.max_attempts;
        const newStatus = finalAttempt ? "failed" : "queued";
        await (supabase as any).from("job_queue").update({
          status: newStatus,
          error_message: msg,
          worker_id: null,
          lease_expires_at: null,
          completed_at: finalAttempt ? new Date().toISOString() : null,
        }).eq("id", job.id);
        await logInternal(supabase, job.id, userId, "error", msg, { stack, final: finalAttempt });
        return { id: job.id, ok: false };
      }
    }, 3);

    const results = settled.map((s) => s.status === "fulfilled" ? s.value : { id: "?", ok: false });
    return {
      processed: jobs.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      duration_ms: Date.now() - totalStart,
    };
  });
