

## External LLM Judge — powered by your OpenAI key

The judge will use the same OpenAI configuration you already supplied (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`) and the per-user `openai_model` preference, exactly like the existing `llm.functions.ts` pipeline. No Lovable AI Gateway, no new secret.

### Database (migration)

New table `run_llm_judgments` (1:1 with runs):
- `id uuid pk`, `run_id uuid` (unique, FK→runs cascade)
- `verdict text` — `agree | partial | disagree`
- `confidence text` — `high | medium | low`
- `reasoning_quality text` — `sound | flawed | unsupported`
- `action_alignment text` — `aligned | partial | misaligned`
- `critique text` (≤300 chars), `disagreement_reason text` nullable
- `model text`, `provider text`
- `error text` nullable, `created_at`, `updated_at`
- RLS via `runs.user_id` (mirror `run_evaluations` policies).

### Server

- `src/server/judge.functions.ts`
  - `judgeRun({ runId })` — loads run + recommendation + parsed action + evaluation + (optional) ground truth, calls OpenAI via the existing `llm.functions.ts` helper using **tool calling** (`submit_judgment`) so output is strictly typed. Resolves model/key/baseURL the same way `llm.functions.ts` does (user pref → `OPENAI_MODEL` → fallback). Persists into `run_llm_judgments` (upsert on `run_id`).
  - `getJudgment({ runId })` — fetch one.
- Hook into `evaluateRun` and `reparseAndEvaluate` in `src/server/evaluation.functions.ts`: after evaluation persists, fire-and-forget `judgeRun(runId)` (non-blocking, errors swallowed into `run_llm_judgments.error`). Gated by user preference `auto_judge_enabled` (see below).
- Failures are non-fatal — they never break the run pipeline.

### Cross-check derivation (no new column)

Computed in the UI/report layer from `run_evaluations` + `run_llm_judgments`:
- `confirmed` — feasible + judge `agree`
- `simulator_only` — feasible + judge `disagree`
- `judge_only` — infeasible + judge `agree`
- `both_reject` — infeasible + judge `disagree`

### UI

- New `src/components/run-details/LlmJudgePanel.tsx` rendered on `/runs/$runId` below `ResultsSummaryPanel`:
  - Verdict badge (green/amber/red), confidence chip, reasoning-quality chip, action-alignment chip
  - Critique text + (when present) disagreement reason
  - Cross-check status pill
  - "Re-judge this run" button (calls `judgeRun`)
  - Empty state: "No judgment yet" + manual run button
- Batch report `/reports/batch/$batchId`: add **Judge–Simulator agreement %** KPI to `KpiCards`/header.
- `AdminSettings` (or per-user preferences page): toggle **Auto-judge new runs** → writes `user_preferences.auto_judge_enabled`. Default off so token spend is opt-in.

### Preferences extension

Migration adds `auto_judge_enabled boolean default false` to `user_preferences`. Update `getMyPreferences` / `updateMyPreferences` in `src/server/preferences.functions.ts`.

### Types & exports

- Add `RunLlmJudgment` to `src/types/grid-arena.ts`; extend `RunDetails` with optional `judgment`.
- Include judge fields in `src/lib/csv-export.ts` for run + batch exports.
- `src/server/runs.functions.ts` — include `judgment` in the run-details fetch.

### Out of scope (v1)

- Multi-judge ensembles, retroactive bulk backfill, chain-of-thought storage, per-batch auto-judge bulk trigger.

### Technical notes (for the dev pass)

- Judge prompt is short and structured — system: "You are an independent power-systems reviewer…", user: serialized run summary. Tool schema enforces enum fields so we never store free-form verdicts.
- Reuses the **existing OpenAI client/wrapper** from `src/server/llm.functions.ts`; no new HTTP code, no new secret.
- 402/429/auth errors from OpenAI surface as `run_llm_judgments.error` and a red "Judge unavailable" chip — never block the run.

