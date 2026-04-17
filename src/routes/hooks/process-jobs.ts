import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron-triggered drain endpoint. Pings claim_jobs for ALL users.
 * Auth: requires Bearer <SUPABASE_PUBLISHABLE_KEY> header (anon key).
 * Called by pg_cron via net.http_post.
 */
export const Route = createFileRoute("/hooks/process-jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const token = auth?.replace("Bearer ", "");
        if (!token) {
          return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401 });
        }

        // Use service-role to enumerate users with queued jobs.
        const url = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !serviceKey) {
          return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500 });
        }
        const admin = createClient(url, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: pending, error } = await admin
          .from("job_queue")
          .select("user_id")
          .in("status", ["queued"])
          .limit(200);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        const userIds = Array.from(new Set((pending ?? []).map((p: any) => p.user_id)));
        let totalProcessed = 0;
        for (const uid of userIds) {
          const { data: claimed } = await admin.rpc("claim_jobs", {
            p_user_id: uid,
            p_limit: 3,
            p_lease_seconds: 60,
            p_worker_id: "cron",
          });
          const jobs = (claimed ?? []) as Array<{ id: string; job_type: string; payload: any; attempts: number; max_attempts: number; user_id: string }>;
          for (const job of jobs) {
            try {
              if (job.job_type === "run_execution") {
                const { executeRunLlmAdmin } = await import("@/server/queue/admin-runner");
                await executeRunLlmAdmin(admin, job.payload?.run_id);
              } else if (job.job_type === "run_perturbation") {
                const { runDefaultPerturbationsForRun } = await import("@/server/perturbation/run-executor");
                await runDefaultPerturbationsForRun(admin, job.payload?.run_id);
              }
              await admin.from("job_queue").update({
                status: "completed",
                completed_at: new Date().toISOString(),
              }).eq("id", job.id);
              await admin.from("job_logs").insert({
                job_id: job.id, user_id: job.user_id, level: "info", message: "Cron-completed",
              });
              totalProcessed++;
            } catch (err: any) {
              const msg = (err?.message ?? String(err)).slice(0, 1000);
              const finalAttempt = job.attempts >= job.max_attempts;
              await admin.from("job_queue").update({
                status: finalAttempt ? "failed" : "queued",
                error_message: msg,
                worker_id: null,
                lease_expires_at: null,
              }).eq("id", job.id);
              await admin.from("job_logs").insert({
                job_id: job.id, user_id: job.user_id, level: "error", message: msg,
              });
            }
          }
        }

        return new Response(JSON.stringify({ ok: true, users: userIds.length, processed: totalProcessed }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
