

## Layer D: Public Release & Documentation

### Audit
- No `/docs` or `/about` routes today. README.md not authored as user-facing.
- Existing presets table can host demo data; existing `executeRunLlm` produces example runs.
- Mermaid diagrams renderable via mermaid.js (need to add) or as static SVG. Simplest: ship as static SVG inline in a Docs page — no new dependency.
- Routes follow flat dot convention under `_authenticated/`. `/about` should be **public** (no auth) so reviewers can read it without signing in — place at top-level `src/routes/about.tsx` and `src/routes/docs.tsx` (and child docs pages).

### Step 1 — Public routes (no auth wall)

New top-level routes (siblings of `index.tsx`, outside `_authenticated/`):
- `src/routes/about.tsx` — `/about` — purpose, authors, affiliation, citation (BibTeX + APA), links.
- `src/routes/docs.tsx` — `/docs` layout with sidebar nav + `<Outlet />`.
- `src/routes/docs.index.tsx` — overview landing.
- `src/routes/docs.installation.tsx` — install/setup (Lovable Cloud + optional simulation-service deploy + secrets).
- `src/routes/docs.usage.tsx` — auth, creating runs, presets, batches.
- `src/routes/docs.workflow.tsx` — end-to-end experiment lifecycle with diagram.
- `src/routes/docs.architecture.tsx` — system diagram (inline SVG).
- `src/routes/docs.reproducibility.tsx` — step-by-step reproduction with expected metrics.
- `src/routes/docs.troubleshooting.tsx` — common failures (LLM timeout, simulator unavailable, queue stuck, RLS errors).

All public — no `_authenticated` parent. Each has `head()` with unique title/description/og tags per the route-architecture rules.

### Step 2 — Shared docs components

- `src/components/docs/DocsLayout.tsx` — sidebar nav + content area, used inside `docs.tsx` layout route.
- `src/components/docs/CodeBlock.tsx` — small wrapper using existing Tailwind for code samples (no syntax highlighter dep — use `<pre>` styled).
- `src/components/docs/ArchitectureDiagram.tsx` — inline SVG showing Frontend (TanStack Start) → Server Functions (Worker) → Postgres + LLM Provider + Simulation Service (pandapower) + DC Solver fallback. Static SVG, no library. Dark-theme friendly.

### Step 3 — Demo dataset seeder

- `src/lib/demo-dataset.ts` — exported constants: 3 demo presets covering case5 / case14 / case30, each with realistic prompt, evaluation_mode `simulation`, model `google/gemini-2.5-flash`.
- New server fn `seedDemoData()` in `src/server/demo.functions.ts` — for the **current authenticated user**: idempotently upserts the 3 presets (matched by name prefix `[Demo]`), and creates 1 example completed run per preset by directly inserting rows (no LLM call, deterministic mock prompt + recommendation + evaluation referencing the DC solver result). Returns `{presets_created, runs_created}`.
- Entry point: a "Load Demo Dataset" button on `/docs/usage` and `/about` that calls `seedDemoData` then toasts a link to `/runs`.

No new tables — uses existing `experiment_presets`, `runs`, `run_metadata`, `run_prompt_logs`, `run_evaluations`. Marker prefix `[Demo]` lets users identify and delete easily.

### Step 4 — Architecture diagram (inline SVG)

Hand-authored SVG inside `ArchitectureDiagram.tsx`:
- Boxes: Browser (TanStack Start UI) → Edge Worker (Server Fns + Queue Worker) → Postgres (RLS, queue, runs, evaluations) — with side connections to LLM Gateway and Simulation Service (pandapower) + in-Worker DC fallback.
- Uses CSS variables (`--primary`, `--muted`, `--border`) so it inherits theme colors.
- Re-used on `/docs/architecture` and embedded as a thumbnail on `/about`.

### Step 5 — Reproducibility page

Documents three reproducible experiments:
1. **Single-run sanity check** — case5, scale_all_loads 0.9, expected: feasibility=true, baseline≥0, post≤baseline (DC solver, deterministic).
2. **Batch-of-3 stability** — load 3 demo presets, run, expect 3 completed, 0 failed.
3. **Validation suite** — run `/validation`, expect parser+evaluation+reproducibility+batch_stability all green.

Each section shows: configuration (preset name, model, mode), one-click "Load this experiment" button (calls `seedDemoData`), expected metrics table, link to /validation.

### Step 6 — Public navigation

Update `NavHeader.tsx`:
- Add public links **Docs** and **About** visible to logged-out users (only those two + Sign In). Logged-in users see existing links plus Docs/About.
- About/Docs reachable at `/about` and `/docs` without login.

Update `__root.tsx` if needed so `/about` and `/docs/*` render outside the `_authenticated` guard (they already will, since they're not under `_authenticated/`).

### Step 7 — Citation block

On `/about` and `/docs`:
- Plain-text APA: "GridArena (2026). LLM Agent Research Platform for Power System Operations. https://power-grid-auditor.lovable.app"
- BibTeX block in a copy-to-clipboard `CodeBlock`.
- Author/affiliation fields use placeholder text (`<Your Name>`, `<Your Institution>`) with an inline note that the user should edit `src/lib/citation.ts` to personalize. Centralizing citation in `src/lib/citation.ts` means one edit propagates everywhere.

### Step 8 — README.md (repo root)

Rewrite `README.md` as the GitHub-facing entry point: project blurb, screenshot link to `/about`, link to `/docs`, simulation-service deploy summary, citation. Mirrors but doesn't duplicate the in-app docs.

### Files

**Created**
- `src/routes/about.tsx`
- `src/routes/docs.tsx` (layout)
- `src/routes/docs.index.tsx`
- `src/routes/docs.installation.tsx`
- `src/routes/docs.usage.tsx`
- `src/routes/docs.workflow.tsx`
- `src/routes/docs.architecture.tsx`
- `src/routes/docs.reproducibility.tsx`
- `src/routes/docs.troubleshooting.tsx`
- `src/components/docs/DocsLayout.tsx`
- `src/components/docs/CodeBlock.tsx`
- `src/components/docs/ArchitectureDiagram.tsx`
- `src/lib/demo-dataset.ts`
- `src/lib/citation.ts`
- `src/server/demo.functions.ts`

**Modified**
- `src/components/NavHeader.tsx` (Docs + About links, visible logged-out)
- `README.md` (rewrite for public consumption)
- `.lovable/memory/index.md` (note Layer D public-docs surface)

### Stability
- Purely additive — no schema changes, no edits to existing server fns.
- `seedDemoData` is idempotent (upsert by preset name) and user-scoped via existing RLS.
- Public docs/about routes don't depend on auth; failure of any docs route can't affect runs/batches.
- Static SVG diagram avoids new dependencies.

