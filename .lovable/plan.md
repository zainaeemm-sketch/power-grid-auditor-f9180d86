

## Plan: Sensitivity / Perturbation Testing Layer

Build a robustness-testing system that re-evaluates an agent's action under perturbed grid conditions. Additive only — existing flows untouched.

### 1. Schema (migration)

```text
perturbation_tests
├─ id uuid pk
├─ run_id uuid (→ runs.id, user-scoped via RLS EXISTS check)
├─ perturbation_type text  -- enum-like: increase_load_percent | decrease_load_percent
│                          --           line_outage | line_restoration
│                          --           generator_limit_change | generator_dispatch_change
│                          --           n1_contingency | voltage_setpoint_shift
├─ parameter_name text
├─ parameter_value numeric
├─ description text
├─ created_at timestamptz default now()

perturbation_results
├─ id uuid pk
├─ perturbation_test_id uuid (→ perturbation_tests.id)
├─ baseline_feasibility text          -- feasible | infeasible | unknown
├─ perturbed_feasibility text
├─ baseline_violations int
├─ perturbed_violations int
├─ violation_change int               -- perturbed − baseline
├─ feasibility_stability text         -- unchanged | lost | gained
├─ robustness_result text             -- stable | degraded | failed
├─ robustness_score numeric           -- 0..1
├─ notes text
├─ execution_time_ms int
├─ failure_reason text                -- nullable; populated on test error
├─ created_at timestamptz default now()
```

RLS: user-scoped via `EXISTS (runs WHERE runs.id = perturbation_tests.run_id AND runs.user_id = auth.uid())`. Same pattern for results joined through tests.

### 2. Perturbation engine (`src/server/perturbation/`)

- `types.ts` — `PerturbationType`, `PerturbationSpec`, `PerturbationResult`.
- `defaults.ts` — `getDefaultPerturbationSet()` returns: `+5%` load, `−5%` load, `line_outage line_id=0`, `generator_limit_change −10%`, `voltage_setpoint_shift +0.02 pu`.
- `apply.ts` — `applyPerturbation(caseDef, spec)` returns a mutated case (deep clone). Pure, deterministic.
- `execute.ts` — orchestrates: load case → apply structured action → baseline eval → for each spec: apply perturbation to case → re-evaluate → compute metrics → write `perturbation_results` (catch per-test errors → record `failure_reason`, continue).
- Reuses existing `runSimulation` (`src/server/simulation/engine.ts`) and rule-based fallback. Honors run's `evaluation_mode`.

### 3. Robustness metrics (`src/server/perturbation/metrics.ts`)

```text
violation_change   = perturbed_violations − baseline_violations
feasibility_stab   = unchanged | lost (feasible→infeasible) | gained (infeasible→feasible)
robustness_result  = stable    if violation_change ≤ 0 AND feasibility unchanged/gained
                     degraded  if 0 < violation_change ≤ 2 AND feasibility unchanged
                     failed    otherwise
robustness_score   = clamp(1 − (max(0, violation_change) / max(1, baseline_violations)) − (lost?0.5:0), 0, 1)
```

### 4. Server functions (`src/server/perturbation.functions.ts`)

- `listPerturbationTests({ runId })` — tests + their latest result.
- `runDefaultPerturbations({ runId })` — generate default set + execute.
- `addCustomPerturbation({ runId, perturbation_type, parameter_name, parameter_value, description? })` — insert + execute one.
- `runBatchPerturbations({ batchId })` — iterate batch runs, run defaults, return aggregate metrics.
- `getBatchRobustnessSummary({ batchId })` — avg score, failure rate, worst-case Δviolations, most sensitive scenario (case_name).

### 5. Run Details panel

New component `src/components/run-details/SensitivityPanel.tsx`, mounted in `src/routes/_authenticated/runs.$runId.tsx` below `GroundTruthComparisonPanel` (no layout redesign — same Card/grid pattern as other panels).

Contents:
- Buttons: **Run Sensitivity Test** (default set), **Add Custom Perturbation** (Dialog: type select / parameter name / value).
- Table cols: Type · Parameter · Baseline feas. · Perturbed feas. · Δ violations · Robustness (badge stable/degraded/failed).
- Empty state: "No sensitivity tests executed."
- Failed-test rows show warning icon + `failure_reason`.

### 6. Batch analytics

In `src/routes/_authenticated/batches.$batchId.tsx` add a "Sensitivity" section (collapsed Card) with:
- **Run Sensitivity Tests for Batch** button.
- Stats: avg robustness, failure rate, worst Δ, most sensitive scenario.
- Charts (recharts, already in project):
  - Robustness distribution — bar (x: agent, y: avg score).
  - Feasibility stability — pie (stable/degraded/failed).
  - Sensitivity heatmap — simple grid (rows: perturbation type, cols: scenario, cell color by Δviolations) implemented with Tailwind div grid (no extra dep).

### 7. CSV export (`src/lib/csv-export.ts`)

- Add `exportSensitivityCsv(runId)` → `sensitivity_run_{runId}.csv` with columns: `perturbation_type, parameter_name, parameter_value, baseline_feasibility, perturbed_feasibility, violation_change, robustness_result, robustness_score, failure_reason`.
- Add `exportBatchSensitivityCsv(batchId)` → `batch_sensitivity_{batchId}.csv` (run_id, case_name, agent + same fields).
- Wire export buttons into the new panels.

### 8. Types

Extend `src/types/grid-arena.ts` with `PerturbationTest`, `PerturbationResult`, `PerturbationType`, `RobustnessResult`, `FeasibilityStability`.

### 9. Determinism & backward compat

- Engine never mutates inputs; uses deterministic ordering of default set; no randomness.
- All new tables/panels are additive. If no perturbation rows exist, run details renders the empty-state message and existing evaluation flow is unchanged.

### Step order during implementation

1. Migration (tables + RLS).
2. `types.ts` + `defaults.ts` + `apply.ts` + `metrics.ts`.
3. `execute.ts` + server functions.
4. `SensitivityPanel` + mount in run details.
5. Batch section + charts.
6. CSV exports.
7. Build + invoke server fns to verify.

### Open defaults (will use unless told otherwise)

- Robustness thresholds as above (0 / 2 violation_change boundaries).
- Default `line_outage` targets line index 0 (first line of case).
- `voltage_setpoint_shift` value = +0.02 pu.
- Custom perturbations execute immediately on add.
- Batch runs perturbations sequentially in one server call (no job queue) — fine for current batch sizes; can move to `job_queue` later if needed.

