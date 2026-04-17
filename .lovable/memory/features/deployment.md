---
name: deployment
description: Phase 9 production deployment notes — health checks, error boundaries, retry/concurrency helpers, custom domain steps
type: feature
---

# Deployment & Operational Stability

- Hosted on Lovable Cloud at `power-grid-auditor.lovable.app`. Frontend changes go live via "Update" in publish dialog; edge/server-fn changes deploy automatically.
- Health page: `/health` (auth-required). Backed by `getHealthStatus` server fn in `src/server/health.functions.ts`. Returns booleans only — never secret values.
- HealthBadge in NavHeader polls every 60s.
- Global error/404: `defaultErrorComponent` on router; `notFoundComponent` on root and per-route loaders.
- LLM retry: `withRetry` helper in `src/lib/server-utils.ts`. Used by `executeRunLlm` for transient 5xx + network errors. Failures are persisted to `run_metadata.notes` and the run status is reverted to `queued` so it can be retried (the DB enum has no `failed` value).
- Batch concurrency: `runWithConcurrency` (cap 3) used in `executeBatchRuns`. One failed child run no longer aborts the batch.
- Custom domain: project must be published first, then add domain in Project Settings → Domains or in the Publish dialog.
