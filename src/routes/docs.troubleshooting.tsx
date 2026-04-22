import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/docs/troubleshooting")({
  head: () => ({
    meta: [
      { title: "Troubleshooting — GridArena Docs" },
      { name: "description", content: "Common GridArena failures and how to diagnose them: LLM timeouts, simulator unavailable, stuck queue, RLS errors." },
      { property: "og:title", content: "Troubleshooting — GridArena Docs" },
      { property: "og:description", content: "Diagnose common GridArena issues: LLM timeouts, simulator, queue, RLS." },
    ],
  }),
  component: TroublePage,
});

function TroublePage() {
  return (
    <>
      <h1>Troubleshooting</h1>

      <h2>Run stuck in “queued”</h2>
      <p>
        Check <code>/system-status</code>. If no worker has claimed the job after a minute,
        click <strong>Process queue now</strong> — this manually drains the queue. If you keep
        the tab open, the client drain hook re-pings the worker every 5 seconds.
      </p>

      <h2>LLM timeout / 504</h2>
      <p>
        Each <code>run_execution</code> job has a 15s default timeout. Failures retry with
        exponential backoff up to <code>max_attempts</code> (default 3). Check the job logs in
        <code>/system-status</code> for the truncated error trace.
      </p>

      <h2>Simulation engine “unavailable”</h2>
      <p>
        The Health badge shows <em>unavailable</em> when the external <strong>PyPSA</strong>{" "}
        service can't be reached. GridArena automatically falls back to the in-Worker DC solver —
        runs still succeed and the engine used is recorded on the evaluation row. To re-enable
        the external engine, verify <code>SIMULATION_SERVICE_URL</code> and{" "}
        <code>SIMULATION_SERVICE_TOKEN</code> in Cloud secrets.
      </p>

      <h2>Diagnose engine failures (admin)</h2>
      <p>
        Admins can open <code>/simulation-health</code> to run end-to-end self-tests against the
        external engine. The page probes <code>/version</code> and <code>/health</code>, then
        executes <code>/simulate</code> in parallel for IEEE case5/14/30 and renders actionable
        troubleshooting tips based on the exact failing endpoint response — missing{" "}
        <code>SIMULATION_SERVICE_URL</code> or <code>SIMULATION_SERVICE_TOKEN</code>, DNS or
        connection errors, 401/403 authentication failures, 5xx with raw response samples, and
        per-case timeout hints. Each probe is stored in history so you can review past failures
        and confirm when a fix took effect. A banner alert fires only on state changes (pass → fail)
        to avoid noise.
      </p>

      <h2>“Unauthorized” errors</h2>
      <p>
        Server functions require a Bearer token from the Supabase session. If you see 401s, sign
        out and back in to refresh the token. RLS will also reject reads if you query data owned
        by another user — by design.
      </p>

      <h2>Validation suite failures</h2>
      <p>
        Open the failing test from <code>/validation</code> and inspect the actual vs. expected
        output. Parser/evaluator versions are recorded so you can correlate failures with code
        changes.
      </p>

      <h2>Demo data clutters my workspace</h2>
      <p>
        Every seeded artifact is prefixed with <code>[Demo]</code>. Filter or delete them from
        <code>/presets</code> and <code>/runs</code> at any time — deletes cascade safely thanks
        to RLS scoping.
      </p>

      <h2>Still stuck?</h2>
      <p>
        Capture a screenshot of the failing page plus the <code>/system-status</code> KPIs and
        recent job logs. That trio is enough to debug nearly every failure mode.
      </p>
    </>
  );
}
