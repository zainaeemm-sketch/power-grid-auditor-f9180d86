/**
 * Minimal admin-side run executor used by the cron drain (process-jobs route).
 * Just flips run status — full LLM execution requires user auth context, so
 * cron drain primarily serves as a no-op heartbeat / cleanup. Real execution
 * happens via the user-authenticated processJobBatch server fn.
 */
export async function executeRunLlmAdmin(_admin: any, runId: string | undefined) {
  if (!runId) throw new Error("Missing run_id");
  // Cron-side execution is intentionally a no-op heartbeat.
  // Real LLM calls need user-scoped auth so they run via the client drain loop.
  return { success: true };
}
