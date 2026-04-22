

## Production Readiness Check on Health Page

Add a one-shot button to `/health` that performs a live end-to-end test of the PyPSA simulator by sending a real `case14` no-op action to `/simulate` and reporting the round-trip result.

### What the user gets

A new "Production readiness" card at the bottom of the System Health page with:
- A **"Run live PyPSA test"** button
- On click: spinner + "Pinging case14…" status
- Results panel showing:
  - HTTP status from the external `/simulate` call
  - Round-trip latency (ms)
  - Engine reported (`pypsa` / fallback)
  - Baseline + post-action violation counts (proves real solve happened)
  - Feasibility flag
  - Any error message returned
- Green/amber/red badge summarizing pass/warn/fail

### Technical changes

**1. New server function: `runProductionReadinessCheck` in `src/server/health.functions.ts`**
- Auth-protected (`requireSupabaseAuth`)
- Uses `SIMULATION_SERVICE_URL` + `SIMULATION_SERVICE_TOKEN` from env
- Sends `POST {url}/simulate` with payload:
  ```json
  { "case_name": "case14", "action": { "enabled": false } }
  ```
- 15s timeout via `AbortSignal.timeout(15_000)`
- Measures latency with `performance.now()`
- Returns:
  ```ts
  {
    ok: boolean;
    status: "pass" | "warn" | "fail";
    http_status: number | null;
    latency_ms: number;
    engine: string | null;
    feasibility: string | null;
    baseline_violations: number | null;
    post_action_violations: number | null;
    notes: string | null;
    error: string | null;
    raw_body_preview: string | null; // first 500 chars
    timestamp: string;
  }
  ```
- Status logic:
  - `pass` — HTTP 200, engine === "pypsa", no error
  - `warn` — HTTP 200 but engine missing/feasibility infeasible
  - `fail` — non-200, timeout, or thrown error
- If `SIMULATION_SERVICE_URL` is not set → returns `fail` with note "External simulator URL not configured"
- Wrapped in try/catch — never throws

**2. UI changes in `src/routes/_authenticated/health.tsx`**
- Add new `<Card>` "Production Readiness" below the existing checklist
- Local state: `readiness: ReadinessResult | null`, `readinessLoading: boolean`
- Button calls `runProductionReadinessCheck()` (no args)
- Result rendering: stat grid (status / latency / engine / violations) + collapsible raw body preview if `fail`
- Use existing `CheckCircle2 / AlertCircle / XCircle` icons keyed by `status`

### Files

- **Edit** `src/server/health.functions.ts` — add `runProductionReadinessCheck` server fn + `ReadinessResult` type export
- **Edit** `src/routes/_authenticated/health.tsx` — add new card, button, state, render logic

### Out of scope

- No DB writes, no history of past runs (one-shot only)
- No changes to `HealthBadge` (it stays a passive `/health` ping)
- No changes to the simulation service itself

