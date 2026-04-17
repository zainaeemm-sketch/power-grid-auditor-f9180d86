
## Layer B: Real Power-System Simulation Integration

### Audit & key constraint

Current evaluation (`src/server/evaluation.functions.ts`) returns hand-coded numbers (e.g. baseline=10, post=8 for `scale_all_loads<1`). Action types in scope: `scale_all_loads`, `set_generator_p_mw`, `line_outage`. No simulation.

**Hard constraint**: GridArena's server runs on Cloudflare Workers (TanStack Start SSR). **pandapower / MATPOWER / PowerModels.jl / GridLAB-D all require Python, MATLAB, Julia or C++ runtimes with native binaries — none can execute inside a Worker.** Running them in-process is not possible.

### Architectural decision

Two viable approaches; both keep evaluation modular and rule-based fallback intact:

- **A. External pandapower microservice (recommended)** — separate Python FastAPI service (hosted anywhere: Fly.io, Render, Hugging Face Space, user's machine). Worker calls it over HTTPS. The repo includes the Python source under `simulation-service/` so the user can deploy or run locally.
- **B. In-Worker JS approximation** — port a tiny DC power-flow solver to TypeScript for the small built-in cases (`case5`, `case14`, `case30`). Physics-correct for DC flow only (no voltage magnitudes, no AC violations). Lower fidelity but zero ops overhead.

I'll use **a tiered system**: try external simulator first → fall back to JS DC power flow → fall back to existing rule-based logic. The user picks the preferred mode per-run; system advertises which engine actually executed.

### Step 1 — Database additions (one migration)

- `run_metadata.evaluation_mode text default 'rule_based'` — values: `rule_based | simulation | auto`.
- `run_evaluations.engine_used text` — what actually ran: `rule_based | dc_powerflow | pandapower`.
- `run_evaluations.simulation_details jsonb` — raw line loadings, voltage magnitudes, generator outputs, violation list.

No table renames; existing rows default cleanly.

### Step 2 — Simulator abstraction

New `src/server/simulation/` module:
- `types.ts` — `PowerSystemCase`, `StructuredAction`, `SimulationResult { feasibility, violations_found, baseline_violations, post_action_violations, line_loadings[], voltage_violations[], generator_violations[], engine }`.
- `cases.ts` — embedded JSON for `case5`, `case14`, `case30` (bus/branch/gen arrays, IEEE standard data).
- `dc-powerflow.ts` — pure TypeScript DC power-flow solver (B·θ = P, Gauss elimination on small matrices), applies action, returns line loadings & violation counts.
- `external-client.ts` — POSTs `{case_name, action}` to `process.env.SIMULATION_SERVICE_URL` with `SIMULATION_SERVICE_TOKEN` auth header; 10s timeout; one retry on 5xx.
- `engine.ts` — `runSimulation(caseName, action, mode)` orchestrator implementing the tiered fallback chain and returning the engine actually used.

### Step 3 — Python microservice scaffold

New top-level `simulation-service/` (not bundled into the Worker — separate deploy):
- `main.py` — FastAPI app, single `POST /simulate` endpoint accepting `{case_name, action}`.
- `pandapower_runner.py` — loads `pp.networks.case5/case14/case30`, applies action, runs `pp.runpp`, returns violations.
- `requirements.txt`, `Dockerfile`, `README.md` with deploy instructions for Fly.io / Render / local.
- Token auth via `SIMULATION_API_TOKEN` env var.

### Step 4 — Wire into evaluation

Refactor `src/server/evaluation.functions.ts`:
- Keep `applyParsedAction` & `computeEvaluation` as the **rule-based fallback path**, unchanged signature.
- New `evaluateWithSimulation(parseResult, mode)` calls `runSimulation`; on success returns full evaluation fields + `engine_used` + `simulation_details`; on failure returns rule-based result with `engine_used='rule_based'`.
- `evaluateRun` and `reparseAndEvaluate` server fns read `run_metadata.evaluation_mode` and dispatch accordingly. `executeRunLlm` flow unchanged otherwise.

### Step 5 — UI: mode selection + status indicator

- **New Run / Presets forms** (`src/routes/_authenticated/new-run.tsx`, `presets.tsx`): add `Evaluation Mode` select (Rule-based / Simulation / Auto). Persists to `experiment_presets` and `run_metadata`.
- **Run details** (`src/components/run-details/ResultsSummaryPanel.tsx`): show `Engine Used` badge (green=pandapower, blue=dc_powerflow, slate=rule_based) and an expandable "Simulation Details" panel listing per-line loadings & voltage violations when `simulation_details` is present.
- **Health page** (`src/routes/_authenticated/health.tsx`): add "Simulation Engine" row that pings `${SIMULATION_SERVICE_URL}/health` → `active | fallback | unavailable` with latency.
- **NavHeader** (`src/components/HealthBadge.tsx`): include simulator status in the badge tooltip.

### Step 6 — Validation suite extension

Add `simulation` test cases to `src/lib/validation/test-cases.ts`: known case + action → expected violation count from DC solver. Confirms the JS fallback is deterministic.

### Step 7 — Secret request

After approval, I'll request two secrets via `add_secret`:
- `SIMULATION_SERVICE_URL` (optional — if absent, system silently uses DC fallback)
- `SIMULATION_SERVICE_TOKEN` (optional)

The user can deploy `simulation-service/` later without code changes.

### Files

**Created**
- `supabase/migrations/<ts>_simulation_fields.sql`
- `src/server/simulation/{types,cases,dc-powerflow,external-client,engine}.ts`
- `simulation-service/{main.py,pandapower_runner.py,requirements.txt,Dockerfile,README.md}`

**Modified**
- `src/server/evaluation.functions.ts` (tiered dispatch, fallback)
- `src/server/llm.functions.ts` (pass evaluation_mode through)
- `src/server/health.functions.ts` (simulator health probe)
- `src/server/runs.functions.ts` (persist evaluation_mode from preset)
- `src/routes/_authenticated/new-run.tsx`, `presets.tsx` (mode selector)
- `src/routes/_authenticated/health.tsx` (simulator row)
- `src/components/run-details/ResultsSummaryPanel.tsx` (engine badge + details)
- `src/components/HealthBadge.tsx` (include simulator)
- `src/types/grid-arena.ts` (extend `RunEvaluation` with `engine_used`, `simulation_details`)
- `.lovable/memory/index.md`, `.lovable/memory/features/db-schema.md`

### Stability & determinism
- DC solver is deterministic (no RNG). External simulator is deterministic for fixed inputs (pandapower Newton-Raphson on fixed networks).
- Existing rule-based path remains as final fallback — no run can ever lose evaluation.
- All changes additive; old runs without new fields render as before (engine badge hidden).
