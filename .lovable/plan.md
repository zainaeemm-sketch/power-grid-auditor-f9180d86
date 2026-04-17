
## Layer C: Performance Optimization & Scaling

### Audit & constraint
- Workers are short-lived (no long-running background workers, no in-memory queue across requests). Current `executeBatchRuns` is synchronous, capped at concurrency 3 via `runWithConcurrency`. UI polls via Supabase queries.
- We must implement the "queue" using the database as the source of truth — every job is a row, workers (server fns) claim and process them. This is the only Worker-compatible pattern.

### Step 1 — Schema (one migration)

**`job_queue`** — durable queue of background jobs:
- `id uuid pk`, `user_id uuid not null`
- `job_type text` (`run_execution` | `batch_execution`)
- `payload jsonb` (e.g. `{run_id}` or `{batch_id}`)
- `status text` (`queued | running | completed | failed | cancelled`) default `queued`
- `priority int default 0`
- `attempts int default 0`, `max_attempts int default 3`
- `started_at timestamptz`, `completed_at timestamptz`
- `execution_time_ms int`, `error_message text`
- `worker_id text` (lease holder), `lease_expires_at timestamptz`
- `created_at`, `updated_at`

**`job_logs`** — execution + error logs + perf metrics:
- `id`, `job_id` (fk by id, no constraint), `level text` (`info | warn | error | metric`), `message text`, `metadata jsonb`, `created_at`

RLS: user-scoped on both. Indexes on `(status, priority, created_at)` and `(job_id, created_at)`.

### Step 2 — Queue helpers (`src/server/queue/`)

- `types.ts` — `JobType`, `JobStatus`, `JobRecord`, `JobLog`.
- `queue.ts` server fns:
  - `enqueueJob({job_type, payload, priority?, max_attempts?})` — inserts row, returns id.
  - `claimNextJobs({limit, lease_seconds=60})` — atomic SQL update via RPC: select `queued` or expired-lease rows, set `status='running'`, `worker_id`, `lease_expires_at`. Uses `SELECT … FOR UPDATE SKIP LOCKED` in a SECURITY DEFINER Postgres function created in the migration.
  - `completeJob(id, {execution_time_ms})`, `failJob(id, error, retryable)` — increments attempts; if `attempts < max_attempts` reverts to `queued`, else marks `failed`.
  - `cancelJob(id)`, `retryJob(id)`.
  - `appendJobLog(id, level, message, metadata?)`.
- `worker.ts`:
  - `processJobBatch({limit=3, timeout_ms=20000})` — server fn: claims up to N jobs, dispatches by `job_type` with `Promise.race` against per-job timeout, logs metrics, releases lease. Reuses existing `executeRunLlm` and inline batch logic (no recursive enqueue).

### Step 3 — Trigger mechanism

Workers can't have always-on background processes, so we use **two triggers**:
1. **Client-side drain loop**: when a user enqueues a batch, the UI calls `processJobBatch` repeatedly (every 5s) until queue is empty for that user. Already-open browsers also drain. Non-blocking — uses background `fetch` + React Query invalidation.
2. **Cron drain (optional, recommended)**: `pg_cron` job every minute calls a `/hooks/process-jobs` route that runs `processJobBatch`. This guarantees jobs progress even when no UI is open. Uses bearer token auth pattern from skill docs.

### Step 4 — Refactor batch execution

- `executeBatchRuns` (existing) → enqueues one `run_execution` job per pending run, returns immediately with `{enqueued: N}`. UI no longer waits for completion.
- New per-run worker calls `executeRunLlm` with timeout (15s default) + retry on transient errors (already in `withRetry`). On non-retryable failure the run remains in `queued` (existing convention) and the job is marked `failed` after max attempts.
- Keeps existing `runWithConcurrency` cap inside one worker invocation; horizontal scale comes from cron + multiple browsers triggering drains.

### Step 5 — `/system-status` dashboard

New route `src/routes/_authenticated/system-status.tsx`:
- KPI cards: Active (running) / Queued / Completed (24h) / Failed (24h) / Avg execution time (ms).
- Live-updating table of recent jobs (last 50) with status badges, attempts, duration.
- Per-row actions: **Cancel** (queued/running), **Retry** (failed). Uses `cancelJob`/`retryJob`.
- Expandable row → recent `job_logs` (info/warn/error/metric).
- "Process queue now" button → calls `processJobBatch` manually for ops use.
- Auto-refresh every 5s via React Query.
- Add "System Status" nav link in `NavHeader` (icon: `Activity`).

### Step 6 — Resource limits

- **Per-job timeout**: `Promise.race` with `setTimeout` reject inside worker. Default 15s (`run_execution`), configurable via job payload.
- **Memory**: enforced by Worker runtime; we add a soft guard by limiting `processJobBatch` concurrency to 3 and capping `claimNextJobs` limit.
- **Retry limits**: `max_attempts` column (default 3); exponential backoff handled by reschedule delay (`lease_expires_at + attempt * 5s`).

### Step 7 — Logging

- Every state transition emits a `job_logs` row (`info`).
- Worker emits `metric` rows with `{phase, duration_ms}` for `claim`, `dispatch`, `total`.
- Errors logged with stack trace truncated to 1KB.
- Old logs pruned by daily `pg_cron` `DELETE FROM job_logs WHERE created_at < now() - interval '7 days'`.

### Step 8 — Wire UI updates

- `batches.$batchId.tsx`: "Run Batch" now calls enqueue + starts a 5s drain loop hook (`useJobDrain`) that pings `processJobBatch` until the batch's runs are all completed/failed. Existing per-row status display works unchanged (run statuses still update via Supabase query).
- New shared hook `src/hooks/useJobDrain.ts` — handles drain timing, abort on unmount, exponential backoff when queue is empty.

### Files

**Created**
- `supabase/migrations/<ts>_job_queue.sql` (tables, RLS, `claim_jobs` SECURITY DEFINER function, indexes, optional pg_cron registration via insert tool after approval)
- `src/server/queue/{types,queue,worker}.ts`
- `src/routes/hooks/process-jobs.ts` (cron-triggered drain endpoint)
- `src/routes/_authenticated/system-status.tsx`
- `src/hooks/useJobDrain.ts`

**Modified**
- `src/server/batch.functions.ts` — `executeBatchRuns` enqueues instead of awaiting
- `src/components/NavHeader.tsx` — add System Status link
- `src/routes/_authenticated/batches.$batchId.tsx` — use `useJobDrain`, show queue progress
- `src/types/grid-arena.ts` — add `JobRecord`, `JobLog`
- `src/integrations/supabase/types.ts` (auto-regenerated)
- `.lovable/memory/index.md`, `.lovable/memory/features/db-schema.md`

### Stability & determinism
- All changes additive. Old single-run path (`executeRunLlm` direct call from new-run.tsx) untouched; users can still execute a single run synchronously.
- Failure of the queue subsystem can't corrupt runs — runs remain authoritative; jobs are pure orchestration metadata.
- Lease + `SKIP LOCKED` prevents double-processing across concurrent drains.
- After approval I'll request whether to enable the optional `pg_cron` drain (requires running an insert-tool SQL with the project anon key).
