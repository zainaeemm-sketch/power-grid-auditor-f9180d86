
## Layer A: System Validation & Reliability Testing

### Audit
- Parser logic lives in `src/server/llm.functions.ts` (used by `executeRunLlm`).
- Evaluation logic computes `violation_improvement`, feasibility, etc. in same file.
- Constants `PARSER_VERSION` and `EVALUATION_LOGIC_VERSION` already exist.
- No test infrastructure today. No `validation_results` table.
- Routes follow flat dot convention under `_authenticated/`.

### Step 1 — Schema (migration)

New table `validation_results`:
- `id uuid pk`, `user_id uuid not null`
- `test_name text not null`, `test_type text not null` (parser | evaluation | reproducibility | batch_stability)
- `expected_output jsonb`, `actual_output jsonb`
- `status text not null` (passed | failed | error)
- `failure_reason text`, `debug_hint text`
- `execution_time_ms integer not null default 0`
- `system_version text`, `parser_version text`, `evaluation_logic_version text`
- `created_at timestamptz default now()`

RLS: user-scoped (`auth.uid() = user_id`) on all four operations, matching project convention.

### Step 2 — Extract pure parser/evaluator

Refactor (additive, non-breaking) `src/server/llm.functions.ts`:
- Export pure functions `parseRecommendation(text)` and `evaluateAction(action, baseline)` so validation tests can call them directly without an LLM round-trip.
- Existing `executeRunLlm` keeps working — it just calls these helpers internally.

### Step 3 — Validation test suite

New `src/lib/validation/test-cases.ts` — deterministic fixture set:
- **Parser cases (~5)**: known recommendation strings → expected `{action_type, target_index, value, enabled}`.
- **Evaluation cases (~4)**: known action + baseline → expected `{feasibility, violation_improvement, confidence}`.
- **Reproducibility case**: parser+evaluator run twice on same input → outputs must deep-equal.
- **Batch stability case**: run all parser+evaluator cases in sequence → all must complete without throwing; report counts.

New `src/server/validation.functions.ts`:
- `runAllValidations()` — executes the suite, persists each result to `validation_results`, returns aggregate.
- `getValidationResults({limit})` — recent results for the dashboard.
- `clearValidationResults()` — optional reset.

All wrapped with `requireSupabaseAuth`. No LLM calls — purely deterministic.

### Step 4 — Validation dashboard route

New route `src/routes/_authenticated/validation.tsx`:
- Header card: total tests, passed, failed, avg execution time (ms).
- "Run All Validation Tests" button → calls `runAllValidations`, shows progress toast.
- Results table grouped by test_type with status badges (green/red/amber).
- Failed-row expandable panel: failure_reason, expected vs actual diff (JSON side-by-side), debug_hint.
- "Export Validation Report" dropdown → CSV or JSON download (client-side, mirrors existing csv-export pattern).
- `errorComponent` + `notFoundComponent` per project convention.

Add nav link "Validation" to `NavHeader.tsx` (icon: `ShieldCheck`).

### Step 5 — Export

Extend `src/lib/csv-export.ts` with `exportValidationCsv(results)` and add `src/lib/validation-export.ts` for JSON export. Both include: test_name, test_type, status, execution_time_ms, expected/actual (stringified), system_version, parser_version, evaluation_logic_version, timestamp.

### Files

**Created:**
- `supabase/migrations/<ts>_validation_results.sql`
- `src/lib/validation/test-cases.ts`
- `src/lib/validation-export.ts`
- `src/server/validation.functions.ts`
- `src/routes/_authenticated/validation.tsx`

**Modified:**
- `src/server/llm.functions.ts` (export pure helpers)
- `src/lib/csv-export.ts` (add `exportValidationCsv`)
- `src/components/NavHeader.tsx` (Validation nav link)
- `.lovable/memory/features/db-schema.md` + `.lovable/memory/index.md` (document new table)

### Stability
- Additive schema; no existing tables touched.
- LLM logic untouched — only refactored to expose pure helpers.
- Validation route is isolated; failure can't impact runs/batches.
- Tests run client-triggered, server-executed, deterministic, no external API calls.
