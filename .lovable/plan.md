
## Phase 9: Production Deployment & Operational Stability

### Audit of current state

- **Hosting**: Already on Lovable Cloud, published at `power-grid-auditor.lovable.app`. No action needed for hosting itself.
- **Secrets**: All required runtime secrets present (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, `SUPABASE_*`, `LOVABLE_API_KEY`).
- **RLS**: Verified user-scoped on all 10 tables.
- **Auth**: Session persistence + `_authenticated` route guard working.
- **Error handling today**: `runs.$runId.tsx` has `errorComponent` + `notFoundComponent`. Most other routes don't. Root route lacks `notFoundComponent`. Router lacks `defaultErrorComponent`.
- **Health checks**: None exist.
- **LLM timeout**: 60s hardcoded, no retry on transient failures.

### Step 1 — Health check page (`/health`)

New route `src/routes/_authenticated/health.tsx` — small ops dashboard:
- **Database**: lightweight `select count` from `runs` → green/red.
- **Auth/session**: read current session → show user email + token freshness.
- **LLM provider**: check that required env-driven config resolves (server fn returns booleans only — never the secret values).
- **Export availability**: client-side check that `Blob` + `URL.createObjectURL` exist.
- **Production checklist**: render the 5-item list from the spec with pass/fail badges.

New server fn `getHealthStatus` in `src/server/health.functions.ts`:
- Returns `{ database: "ok"|"error", llmConfigured: boolean, hasApiKey: boolean, hasBaseUrl: boolean, hasModel: boolean, timestamp }`.
- Never returns secret values — only presence booleans.

Add link to `/health` from the `NavHeader` profile dropdown ("System Health").

### Step 2 — Global error & 404 boundaries

- **`src/router.tsx`**: add `defaultErrorComponent` with reset/retry button + readable error message.
- **`src/routes/__root.tsx`**: add `notFoundComponent` (global 404 with link home).
- **All `_authenticated/*` routes** that have loaders (runs.index, batches.index, batches.$batchId, presets, compare): add `errorComponent` + simple loading state pattern. Keeps current UI; just fills the gaps.

### Step 3 — Operational error handling for LLM execution

Update `src/server/llm.functions.ts`:
- Wrap fetch in retry loop (1 retry on 5xx or network error; not on 4xx since those are config/auth issues).
- On final failure, write `error_message` into `run_metadata.notes` (append) so it surfaces in UI without schema changes.
- Set `runs.status = "failed"` (already exists in enum) instead of leaving as "running".
- Return structured error with `retryable: boolean` flag so UI can show a "Retry" button.

Update `RunStatusControls.tsx`: when status is `failed`, show a "Retry Run" button that re-invokes `executeRunLlm`.

### Step 4 — Batch stability for long jobs

`src/server/batch.functions.ts`:
- Currently runs all child runs sequentially in one server fn call → risks Worker timeout for big batches.
- Add **concurrency cap of 3** with a small `Promise.allSettled` pool — speeds up small batches without overwhelming the LLM provider.
- Per-run errors no longer abort the batch; failed runs marked `failed` with reason in metadata, batch still completes.
- Add a per-run timeout guard (already 60s in LLM call; document this).

### Step 5 — Loading states

- Replace silent "Loading run details…" text in `runs.$runId.tsx` with a skeleton matching the panel layout.
- Add a top-level `<PageTransition>` indicator (component already exists) on protected routes that fetch data.
- Add a small `<HealthBadge>` to `NavHeader` (green dot when last health check OK, red dot if failed) — only shown when authenticated.

### Step 6 — Production branding & custom domain readiness

- Update `public/manifest.json`: ensure `name`, `short_name`, `theme_color`, `background_color` reflect GridArena (verify, don't redesign).
- Update `__root.tsx` `<head>` meta: add `og:title`, `og:description`, `og:image` (using existing assets if any), `twitter:card`. This makes shareable links polished for production.
- Document custom-domain setup as a one-paragraph note in `mem://features/deployment` (new memory file).

### Step 7 — Maintainability

- Extract retry/timeout helpers to `src/lib/server-utils.ts` (so future server fns can reuse).
- Add JSDoc comments to all server functions explaining inputs/outputs.

### Files

**Created:**
- `src/routes/_authenticated/health.tsx`
- `src/server/health.functions.ts`
- `src/lib/server-utils.ts`
- `src/components/HealthBadge.tsx`
- `mem://features/deployment.md`

**Modified:**
- `src/router.tsx` (defaultErrorComponent)
- `src/routes/__root.tsx` (notFoundComponent + og meta)
- `src/routes/_authenticated/runs.index.tsx`, `batches.index.tsx`, `batches.$batchId.tsx`, `presets.tsx`, `compare.tsx` (errorComponent + skeletons)
- `src/routes/_authenticated/runs.$runId.tsx` (skeleton loading state)
- `src/server/llm.functions.ts` (retry, failure persistence, status=failed)
- `src/server/batch.functions.ts` (concurrency pool, allSettled)
- `src/components/run-details/RunStatusControls.tsx` (Retry Run button when failed)
- `src/components/NavHeader.tsx` (HealthBadge + System Health link)
- `public/manifest.json` (production branding verification)
- `mem://index.md` (link new deployment memory)

### Stability strategy

- All changes are additive. No schema migrations required (failure messages reuse existing `run_metadata.notes` field; status transitions reuse existing `run_status` enum which already includes `failed`).
- Each step shippable independently; if any one breaks, prior steps remain stable.
- Health check page is read-only and isolated — safe to land first as smoke test.
