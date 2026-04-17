
This is a large feature spanning schema, routes, server functions, UI panels, batch analytics, and exports. I'll present a concise plan covering all 11 parts, organized by implementation order.

## Plan: Ground Truth / Reference Solution Layer

### 1. Database schema (migration)

Two new tables + one column on `runs`:

```text
ground_truth_scenarios
├─ id (uuid, pk)
├─ scenario_id (text, unique)      -- e.g. "IEEE14_OVERLOAD_01"
├─ case_name (text)
├─ scenario_description (text)
├─ difficulty_level (text)         -- easy | medium | hard
├─ user_id (uuid)                  -- ownership for RLS
└─ created_at / updated_at

ground_truth_actions
├─ id (uuid, pk)
├─ scenario_id (uuid, fk → ground_truth_scenarios ON DELETE CASCADE)
├─ action_type (text)
├─ target_index (int, nullable)
├─ value (double, nullable)
├─ expected_feasibility (bool)
├─ expected_violations (int)
├─ expected_violation_improvement (numeric)
├─ notes (text, nullable)
└─ created_at

runs  (ALTER)
└─ ground_truth_scenario_id (uuid, nullable, no FK — stays soft-linked for backward compat)
```

RLS: `user_id = auth.uid()` on scenarios; actions inherit via EXISTS on parent scenario (same pattern as `run_metadata`). Scenarios are user-owned (so each researcher curates their own registry). Seed rows will be inserted per-user on first visit — covered in step 7.

### 2. Types & server functions

- `src/types/grid-arena.ts` → add `GroundTruthScenario`, `GroundTruthAction`, `GroundTruthComparison`.
- `src/server/ground-truth.functions.ts` (new):
  - `listScenarios()` — list with action counts
  - `getScenario({ id })` — scenario + actions
  - `createScenario({ scenario, actions })` — one scenario + N actions in a single call
  - `deleteScenario({ id })`
  - `seedExampleScenarios()` — idempotent; inserts IEEE14_OVERLOAD_01 and IEEE39_LINE_OUTAGE if missing for current user

All use `requireSupabaseAuth` middleware (RLS-scoped).

### 3. Comparison logic (pure function, deterministic)

`src/server/ground-truth/compare.ts`:

```ts
compareToGroundTruth(agentAction, agentEval, referenceActions) → {
  action_match: "exact" | "partial" | "none",
  feasibility_match: "correct" | "incorrect",
  optimality_gap: number,           // expected_improvement - actual_improvement
  deviation_from_reference: number, // |expected_value - agent_value|, or Infinity if type mismatch
  matched_reference_action_id: string | null,
}
```

Rules:
- **exact**: same `action_type` AND same `target_index` AND `|value - expected| < 1e-6`
- **partial**: same `action_type` (and target_index if both set), value differs
- **none**: different action_type or no reference actions
- When multiple reference actions exist, pick the best match (exact > partial > none).

Integrated into `executeRunLlm` in `src/server/runs.functions.ts` **after** the existing evaluation write. Results stored in `run_evaluations` (new columns below). If `run.ground_truth_scenario_id` is null → skip entirely, write `evaluation_against_ground_truth = false`.

### 4. Evaluation schema extension

ALTER `run_evaluations`:
- `action_match` text nullable
- `feasibility_match` text nullable
- `optimality_gap` numeric nullable
- `deviation_from_reference` numeric nullable
- `evaluation_against_ground_truth` bool default false

All nullable → existing runs unaffected (backward compat ✓).

### 5. Routes & UI

**New routes** (all under `_authenticated`):
- `/ground-truth` → `_authenticated/ground-truth.index.tsx` — list + "New" button + "Seed examples" button
- `/ground-truth/new` → `_authenticated/ground-truth.new.tsx` — creation form (scenario fields + repeatable reference-action rows, add/remove)
- `/ground-truth/$id` → `_authenticated/ground-truth.$id.tsx` — detail view (read-only, with delete)

**New-run form** (`_authenticated/new-run.tsx`): add optional `<Select>` "Ground Truth Scenario (optional)" populated from `listScenarios()`. Stored on `runs.ground_truth_scenario_id`.

**NavHeader**: add "Ground Truth" link between existing items.

**Run Details** (`_authenticated/runs.$runId.tsx`): new panel component `src/components/run-details/GroundTruthComparisonPanel.tsx`. Renders:
- "No ground truth available" if `evaluation_against_ground_truth === false`
- Otherwise: two-column Reference vs Agent action, then badges for Action Match / Feasibility Match / Optimality Gap

Loader fetches scenario+actions alongside existing `getRunDetails` (extend the server function to include them when `ground_truth_scenario_id` is set).

### 6. Batch analytics (`src/lib/batch-summary.ts` + reports)

Add to `src/lib/batch-summary.ts`:
- `accuracyRate(runs)` — % with `action_match === "exact"` among runs that have ground truth
- `avgOptimalityGap(runs)`
- `feasibilityAgreementRate(runs)`
- `bestAgentVsGroundTruth(runs)` — groups by `run.agent`, picks highest accuracy

New chart in `reports.batch.$batchId.tsx`: bar chart (reusing existing `ReportChart` / recharts) — x: agent, y: accuracy %.

Only shown when at least one run in the batch has `evaluation_against_ground_truth = true`.

### 7. CSV export (`src/lib/csv-export.ts`)

Extend `exportRunCsv` and batch CSV export with columns:
- `ground_truth_scenario_id`
- `reference_action_type`
- `reference_value`
- `action_match`
- `feasibility_match`
- `optimality_gap`

Empty strings when ground truth absent.

### 8. Seed data

On first visit to `/ground-truth`, if the user has zero scenarios, show a "Seed example scenarios" button (not auto-run, avoids surprise writes). Calls `seedExampleScenarios()` which inserts:

```text
IEEE14_OVERLOAD_01  (easy)  — scale_all_loads, value 0.95, feasible, 0 violations, improvement 3
IEEE39_LINE_OUTAGE  (medium) — line_outage, target_index 4, feasible, 1 violation, improvement 2
```

### Implementation order (incremental, app stays green after each)

```text
1. Migration: new tables + runs.ground_truth_scenario_id + run_evaluations columns
2. Types + ground-truth.functions.ts (server + seed)
3. /ground-truth list, new, detail pages + NavHeader link
4. new-run: optional scenario selector
5. compareToGroundTruth() pure function + integrate into executeRunLlm
6. GroundTruthComparisonPanel on run details
7. Batch analytics + new chart
8. CSV export columns
```

### Backward compatibility guarantees

- `ground_truth_scenario_id` nullable → existing runs keep working.
- Comparison only runs when scenario_id present → no extra compute otherwise.
- New `run_evaluations` columns all nullable → existing rows untouched.
- Panel shows "No ground truth available" when absent → UI stable.
- RLS user-scoped → each researcher's registry is isolated.

### Files to create

```text
supabase/migrations/<ts>_ground_truth.sql
src/server/ground-truth.functions.ts
src/server/ground-truth/compare.ts
src/routes/_authenticated/ground-truth.index.tsx
src/routes/_authenticated/ground-truth.new.tsx
src/routes/_authenticated/ground-truth.$id.tsx
src/components/run-details/GroundTruthComparisonPanel.tsx
```

### Files to edit

```text
src/types/grid-arena.ts
src/components/NavHeader.tsx
src/routes/_authenticated/new-run.tsx
src/routes/_authenticated/runs.$runId.tsx
src/server/runs.functions.ts            (integrate comparison)
src/lib/batch-summary.ts
src/routes/_authenticated/reports.batch.$batchId.tsx
src/lib/csv-export.ts
.lovable/memory/features/db-schema.md   (update schema memory)
```

### Open decisions (reasonable defaults chosen — tell me to change if wrong)

- **Ownership model**: scenarios are per-user (not global). If you want a shared/global registry, say so and I'll drop `user_id` + add admin-only write policy.
- **Seed behavior**: manual button, not auto-insert on first login.
- **Exact-match tolerance**: `1e-6` on value comparison.
- **Optimality gap sign**: `expected_improvement - actual_improvement` (positive = agent underperformed).
