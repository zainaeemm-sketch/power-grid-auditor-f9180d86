import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";
import type { JobLogLevel, JobRecord, JobType } from "./types";

export const enqueueJob = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: {
    job_type: JobType;
    payload: Record<string, any>;
    priority?: number;
    max_attempts?: number;
  }) => input)
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const { data: row, error } = await (supabase as any)
      .from("job_queue")
      .insert({
        user_id: userId,
        job_type: data.job_type,
        payload: data.payload,
        priority: data.priority ?? 0,
        max_attempts: data.max_attempts ?? 3,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(`Failed to enqueue: ${error?.message}`);
    await appendLogInternal(supabase, row.id, userId, "info", "Job enqueued", { job_type: data.job_type });
    return { id: row.id };
  });

async function appendLogInternal(
  supabase: any,
  jobId: string,
  userId: string,
  level: JobLogLevel,
  message: string,
  metadata?: Record<string, any>,
) {
  try {
    await supabase.from("job_logs").insert({
      job_id: jobId,
      user_id: userId,
      level,
      message: message.slice(0, 2000),
      metadata: metadata ?? null,
    });
  } catch (err) {
    console.error("Failed to write job log:", err);
  }
}

export const appendJobLog = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { job_id: string; level: JobLogLevel; message: string; metadata?: Record<string, any> }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await appendLogInternal(supabase, data.job_id, userId, data.level, data.message, data.metadata);
    return { success: true };
  });

export const cancelJob = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { job_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as any)
      .from("job_queue")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", data.job_id)
      .in("status", ["queued", "running"]);
    if (error) throw new Error(`Cancel failed: ${error.message}`);
    await appendLogInternal(supabase, data.job_id, userId, "info", "Job cancelled by user");
    return { success: true };
  });

export const retryJob = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { job_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as any)
      .from("job_queue")
      .update({
        status: "queued",
        attempts: 0,
        error_message: null,
        started_at: null,
        completed_at: null,
        worker_id: null,
        lease_expires_at: null,
      })
      .eq("id", data.job_id);
    if (error) throw new Error(`Retry failed: ${error.message}`);
    await appendLogInternal(supabase, data.job_id, userId, "info", "Job manually re-queued");
    return { success: true };
  });

export const listRecentJobs = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ jobs: JobRecord[] }> => {
    const { supabase } = context;
    const { data, error } = await (supabase as any)
      .from("job_queue")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { jobs: (data ?? []) as JobRecord[] };
  });

export const getJobLogs = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { job_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: logs, error } = await (supabase as any)
      .from("job_logs")
      .select("*")
      .eq("job_id", data.job_id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { logs: logs ?? [] };
  });

export const getJobStats = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data, error } = await (supabase as any)
      .from("job_queue")
      .select("status, execution_time_ms, created_at");
    if (error) throw new Error(error.message);
    const jobs = (data ?? []) as Array<{ status: string; execution_time_ms: number | null; created_at: string }>;
    const recent = jobs.filter((j) => j.created_at >= since);
    const completed24 = recent.filter((j) => j.status === "completed");
    const avgMs = completed24.length > 0
      ? Math.round(completed24.reduce((s, j) => s + (j.execution_time_ms ?? 0), 0) / completed24.length)
      : 0;
    return {
      active: jobs.filter((j) => j.status === "running").length,
      queued: jobs.filter((j) => j.status === "queued").length,
      completed_24h: completed24.length,
      failed_24h: recent.filter((j) => j.status === "failed").length,
      avg_execution_ms: avgMs,
    };
  });
