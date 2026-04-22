

## Goal
Replace the broken pandapower microservice with a PyPSA-based one. Same external HTTP contract — no changes needed in the TypeScript app.

## Why PyPSA will work where pandapower didn't
- Pure Python, no native binaries, no read-only DataFrame issues from pandas internals
- Built-in support for IEEE test cases (case5, case14, case30) via `pypsa.examples` or by importing MATPOWER `.m` files
- Deploys cleanly on Railway/Fly with just `pip install pypsa` — no system packages, no compilation
- Same DC and AC power flow capabilities we need

## Scope of changes

**All changes live inside `simulation-service/`. Zero changes to the TypeScript app** — the existing `external-client.ts` already speaks the right HTTP contract (`POST /simulate`, `POST /simulate_perturbed`, `GET /health`). We just swap the engine behind those endpoints.

### Files to rewrite

1. **`simulation-service/requirements.txt`**
   - Remove: `pandapower`, pinned `pandas`/`numpy`
   - Add: `pypsa>=0.27`, `pandas`, `numpy`, `scipy` (PyPSA needs scipy for solvers)
   - Keep: `fastapi`, `uvicorn`, `pydantic`

2. **`simulation-service/pandapower_runner.py` → rename to `pypsa_runner.py`**
   - Rebuild case loading: PyPSA can load IEEE cases from MATPOWER format. Bundle the `.m` files for case5/case14/case30 (small, ~5KB each) in `simulation-service/cases/`, or use `pypsa.examples.ac_dc_meshed()` and similar built-ins.
   - Reimplement these functions to return the same response shape:
     - `run_baseline(case_name)` → DC/AC PF, count violations
     - `run_with_action(case_name, action)` → apply structured action (gen redispatch, line outage, load shed, switch toggle), rerun PF, return loadings + violation deltas
     - `run_perturbed(case_name, action, perturbation)` → apply perturbation to network, then run baseline + action
   - Action mapping: PyPSA's `network.generators`, `network.lines`, `network.loads` are normal mutable DataFrames — no read-only issues.
   - Return same JSON shape `external-client.ts` expects: `feasibility`, `baseline_violations`, `post_action_violations`, `violation_improvement`, `line_loadings[]`, `voltage_violations[]`, `generator_violations[]`, `notes`.

3. **`simulation-service/main.py`**
   - Update imports: `from pypsa_runner import …`
   - Bump `BUILD_VERSION` to `2026-04-22-pypsa-v1`
   - Keep `/health`, `/version`, `/simulate`, `/simulate_perturbed` endpoints with identical request/response schemas
   - Keep `try/except` wrapper that returns 200 + infeasibility note instead of HTTP 500

4. **`simulation-service/Dockerfile`**
   - Drop `gcc g++` system packages (PyPSA doesn't need compilation)
   - Otherwise unchanged

5. **`simulation-service/README.md`**
   - Update to document PyPSA engine, supported cases, env vars, deploy steps for Railway

### What stays the same
- `src/server/simulation/external-client.ts` — no changes
- `src/server/simulation/engine.ts` — no changes
- `src/server/simulation/dc-powerflow.ts` — stays as last-resort fallback
- `/health` UI in `src/routes/_authenticated/health.tsx` — same engine label logic; will show `pandapower` engine name in `SimulationResult.engine` field. **Optional small tweak**: rename the engine field value from `"pandapower"` to `"pypsa"` for honesty (1-line change in `types.ts` + `external-client.ts` + UI label map).

### Deployment after code changes
1. Lovable pushes to GitHub automatically
2. Railway rebuilds the `simulation-service/` folder (Root Directory already set from prior plan)
3. Verify `https://gridarena-sim-production.up.railway.app/version` returns `2026-04-22-pypsa-v1`
4. Refresh `/health` in app — Simulation Engine should flip to ✅ Active

## Risks & mitigations
- **PyPSA case loading**: if MATPOWER import is fiddly, fall back to building case5/14/30 networks programmatically (PyPSA networks are just dataframes — ~50 lines of code per case).
- **Action semantics**: structured actions today assume pandapower indices. We'll map them to PyPSA component names (e.g. `gen_0` → first generator). Documented in the runner.
- **Solver**: PyPSA uses pyomo + a solver for OPF. For plain PF (which is what we need), it uses scipy/numpy directly — no extra solver install needed.

## Out of scope
- No DB schema changes
- No new env vars
- No changes to TypeScript app logic, UI flows, or auth
- No changes to other simulation tiers (DC PF stays as built-in fallback)

