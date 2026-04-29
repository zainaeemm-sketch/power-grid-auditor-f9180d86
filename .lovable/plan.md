
# Plan: AI Bulk-Fix Suggestions + Nightly Validation Report

Two independent features sharing the existing `/docs/cases` validation pipeline (`findCaseMetaIssues`, `exportIssues`).

---

## Feature 1 — AI Bulk-Fix Suggestions (OpenAI)

### User flow

1. On `/docs/cases`, each invalid row gets a new **"Suggest fix"** button. A header **"Suggest fixes for all (N)"** triggers the same per-row call in batch.
2. Clicking opens a **Suggestion Review Drawer** showing, per row:
   - Field, current value (or "missing"), severity, validation message.
   - AI-proposed value + one-line rationale.
   - Per-row actions: **Accept**, **Reject**, **Edit** (inline textarea).
3. **Apply selected** writes accepted suggestions to a new `case_meta_overrides` table.
4. `findCaseMetaIssues` is updated to merge overrides on top of source `CASE_META` before validating, so accepted fixes immediately resolve the corresponding issues.
5. An **"Overrides"** section on the panel lists active overrides with **Revert** per row.

### Data model (new migration)

Table `case_meta_overrides`:
- `id uuid PK`
- `user_id uuid not null` (RLS scope)
- `case_key text not null` (e.g. `case14`)
- `field text not null` (e.g. `prompt_version`, `random_seed`, `dataset_version`)
- `value jsonb not null` (typed value — string, number, or array)
- `source text not null check (source in ('ai_suggested','manual'))`
- `ai_rationale text`
- `ai_model text`
- `created_at`, `updated_at`
- Unique `(user_id, case_key, field)`
- RLS: `auth.uid() = user_id` for all CRUD.

### Server functions (`src/server/case-fix.functions.ts` + `case-fix.server.ts`)

- `suggestCaseMetaFix({ caseKey, field, currentValue, severity, message, neighborSamples })` — calls OpenAI Chat Completions API directly (`OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` already in secrets) with a constrained tool-calling schema returning `{ value, rationale, confidence }`. Server-side rate limit (in-memory token bucket per user, 20 req/min).
- `acceptCaseMetaFix({ caseKey, field, value, rationale, model })` — upsert into `case_meta_overrides`.
- `listCaseMetaOverrides()` — for current user.
- `revertCaseMetaOverride({ id })` — delete row.
- All wrapped with `requireSupabaseAuth`; Zod input validators.

### Validation merge

- New helper `mergeOverrides(meta, overrides)` in `src/lib/case-meta.ts`.
- `docs.cases.tsx` loader (or a new server fn `getCaseMetaWithOverrides`) returns the merged record so the existing panel naturally shows fewer issues once fixes are applied.

### UI files

- `src/components/docs/SuggestionReviewDrawer.tsx` — drawer + per-row Accept/Reject/Edit.
- `src/components/docs/OverridesSection.tsx` — list active overrides.
- Hook: `useSuggestFix` wrapping the server fn with toast feedback for 429 / 402 / network errors.

### Safety

- Suggestions never auto-apply.
- AI output is validated against the same `case-meta` rules before it can be accepted (e.g. `prompt_version` must match `PROMPT_VERSION_RE`).
- Overrides are user-scoped; one user's overrides never affect another.

---

## Feature 2 — Nightly Validation Report (Resend cron)

### Pipeline

```
pg_cron (nightly 06:00 UTC)
   → POST /api/public/hooks/nightly-validation-report
       → build invalid-items export (CSV + JSON)
       → look up admin emails (user_roles.role='admin' join auth.users)
       → send via Resend connector gateway with CSV attachment + summary HTML
       → log to nightly_report_runs table
```

### Connector

- Use **Resend** via the connector gateway (`https://connector-gateway.lovable.dev/resend/emails`).
- Will trigger `standard_connectors--connect` for `resend` during build; user picks/creates the connection. From-address default `reports@gridarena.eu` (user-overridable later).

### Server route

- New file: `src/routes/api/public/hooks/nightly-validation-report.ts`.
- Auth: validates `apikey` header equals `SUPABASE_PUBLISHABLE_KEY` (matches existing public-hook pattern).
- Builds the report by reusing `findCaseMetaIssues` + the `buildIssueRows` / `exportIssues` logic, factored out of `docs.cases.tsx` into a shared helper `src/lib/case-meta-report.ts` (pure, no DOM dependencies).
- Uses `supabaseAdmin` to read admin emails and to insert a row into `nightly_report_runs`.

### Cron + logging

- New table `nightly_report_runs` (admin-readable):
  - `id`, `ran_at`, `recipients_count`, `total_errors`, `total_warnings`, `status`, `error_message`.
- pg_cron job (inserted via SQL, not migration) calls the hook with empty body. Stable URL: `https://project--e5ab4643-4a3d-48dd-b431-22a28f4c4f37.lovable.app/api/public/hooks/nightly-validation-report`.
- Schedule: `0 6 * * *` (daily 06:00 UTC). Configurable later.

### Email content

- Subject: `[GridArena] Nightly validation report — {N} errors, {M} warnings`.
- Body (HTML): summary table (filter, total cases, errors, warnings, top 5 cases by issue count) + link back to `/docs/cases`.
- Attachment: full CSV (`exportIssues` payload, scope=all).

### Admin UI (small)

- New section on `/admin` (existing route) listing recent `nightly_report_runs` with status + counts and a **Send now** button that invokes the same hook on demand.

---

## Documentation (full treatment)

### `/docs/cases` (inline, detailed)

New section **"AI bulk-fix suggestions"** below the existing "Exporting invalid items":
- How to trigger per-row vs. bulk suggest.
- Worked example: missing `prompt_version` → AI suggests `case14-baseline@1.0.0`.
- Review drawer screenshots/description; Accept/Reject/Edit semantics.
- Overrides table behavior (user-scoped, reversible).

New section **"Nightly validation report"**:
- Schedule (daily 06:00 UTC), recipients (admins), payload (CSV attachment + HTML summary).
- How to trigger ad-hoc from `/admin`.

### `/docs/architecture`

Add a new subsection **"Validation feedback loop"** to the architecture doc with an ASCII pipeline:

```text
CASE_META  ──►  findCaseMetaIssues  ──►  /docs/cases panel ──►  Suggest fix ─► OpenAI
                       │                        │                                │
                       │                        ▼                                ▼
                       │                 ExportPreviewModal              case_meta_overrides
                       ▼                        │                                │
              pg_cron (nightly)                 ▼                                │
                       │                  CSV / JSON download                    │
                       ▼                                                         │
        /api/public/hooks/nightly-validation-report ◄───────────────────────────┘
                       │
                       ▼
                Resend (admin emails)
```

### `/docs/methodology`

Add subsection **"AI-assisted validation fixes"** explaining:
- Why human-in-the-loop: AI suggestions never auto-apply; users review every change.
- Reproducibility: overrides are stored with model + rationale, queryable for audit.
- Bias / limitations: model may pick plausible but wrong defaults; reviewer must verify against case provenance.
- Reporting: nightly emails ensure issues stay visible to admins even if no one opens the panel.

---

## File summary

**New**
- DB migrations: `case_meta_overrides`, `nightly_report_runs` tables (+ RLS).
- `src/server/case-fix.server.ts`, `src/server/case-fix.functions.ts`
- `src/lib/case-meta-report.ts` (extracted shared report builder)
- `src/components/docs/SuggestionReviewDrawer.tsx`, `OverridesSection.tsx`
- `src/routes/api/public/hooks/nightly-validation-report.ts`
- pg_cron schedule (SQL via insert tool, not migration)

**Modified**
- `src/lib/case-meta.ts` — add `mergeOverrides` + accept overrides in `findCaseMetaIssues`.
- `src/routes/docs.cases.tsx` — wire suggest buttons, drawer, overrides section, new docs sections.
- `src/routes/docs.architecture.tsx` — validation feedback loop subsection.
- `src/routes/docs.methodology` route (or wherever methodology lives — confirm during build) — AI-assisted fixes subsection.
- `src/routes/_authenticated/admin.tsx` — recent nightly runs + "Send now" button.

**Connectors / secrets**
- Triggers `standard_connectors--connect` for **Resend** during build.
- Uses existing `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## Open assumption to confirm during build

The project currently has no `/docs/methodology` route in the file list — only `docs.architecture.tsx`, `docs.workflow.tsx`, `docs.reproducibility.tsx`. If methodology content lives inside one of those (likely `docs.workflow.tsx` or `docs.reproducibility.tsx`), the methodology subsection will be added there instead of creating a new route. Will confirm and pick the best fit on first edit.
