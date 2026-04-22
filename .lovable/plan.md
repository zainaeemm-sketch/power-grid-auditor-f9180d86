

## Goal
Update the docs, methodology, and architecture to reflect: (1) PyPSA replacing pandapower, (2) the new admin-only Simulation Health page with history, alerts, and troubleshooting tips.

## Files to update

### 1. `README.md`
- Rename "Optional simulation service" section: pandapower → **PyPSA**.
- Update description: "physics-accurate AC powerflow" → "physics-accurate power flow via PyPSA (pure Python, no native binaries)".
- Mention `/simulation-health` (admin-only) for engine self-tests.

### 2. `src/routes/docs.installation.tsx`
- Replace all "pandapower" mentions with "PyPSA".
- Section 5 ("Verifying the install"): add bullet for `/simulation-health` (admin) — runs `/version`, `/health`, and `/simulate` self-tests across case5/14/30 and stores history.

### 3. `src/routes/docs.architecture.tsx`
- Rewrite **Simulation Service** section: FastAPI + **PyPSA** (was pandapower); pure-Python, supports IEEE case5/14/30; same external HTTP contract (`/version`, `/health`, `/simulate`).
- Add a new **Simulation Health (admin)** subsection describing the diagnostics layer: probes `/version` + `/health` + parallel `/simulate` for case5/14/30, persists results to `simulation_health_checks` (RLS-scoped), surfaces state-change alerts and contextual troubleshooting tips. Admin-gated server-side via `has_role`.

### 4. `src/components/docs/ArchitectureDiagram.tsx`
- Change "Simulation Service" subtitle from `pandapower (Python)` → `PyPSA (Python)`.
- Add a small "Simulation Health (admin)" badge/box connected to Edge Worker + Postgres (writes to `simulation_health_checks`).

### 5. `src/routes/docs.workflow.tsx`
- Section "5. Simulation & Evaluation": pandapower → PyPSA.
- Counterfactual caveats: unchanged (still in-Worker DC).

### 6. `src/components/docs/MethodologyDiagram.tsx`
- Update tier-1 label: `pandapower (external AC)` → `PyPSA (external power flow)`.

### 7. `src/routes/docs.troubleshooting.tsx`
- Rename section "Simulation engine 'unavailable'": pandapower → PyPSA.
- Add new section **"Diagnose engine failures (admin)"** pointing to `/simulation-health` — explains the page surfaces actionable tips for missing `SIMULATION_SERVICE_URL`/`TOKEN`, DNS/connection errors, 401/403, 5xx, and per-case timeout hints; history table lets you review past failures.

### 8. `src/components/docs/DocsLayout.tsx` + `src/routes/docs.index.tsx`
- No nav change required (Simulation Health is an app route, not a docs page). Add a one-line callout in `docs.index.tsx` "Where to start" list pointing admins to `/simulation-health`.

## Out of scope
- No code/logic changes to the simulation engine, RBAC, or alert behavior.
- No DB migrations.
- No changes to citation, about page, or memory files.

