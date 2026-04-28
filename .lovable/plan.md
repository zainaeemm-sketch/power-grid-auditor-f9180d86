# Add `/docs/cases` — Test System Reference

Add a new docs page that documents the three built-in power-system presets (case5, case14, case30) with topology summaries, full bus/branch/generator tables, ratings, and references — sourced directly from `src/server/simulation/cases.ts` so the docs match what the solver actually runs.

## Files

### 1. New: `src/routes/docs.cases.tsx`
TanStack route at `/docs/cases`. Renders inside `DocsLayout` (auto via file-based nesting under `docs.tsx`). Includes route-specific `head()` metadata (title, description, og:title, og:description).

Page structure:
- **H1**: "Test Systems"
- **Intro**: Explain these are simplified IEEE-style benchmarks used by the in-Worker DC solver and PyPSA service; note the DC-PF assumptions (lossless, flat 1.0 pu voltages, small-angle, greedy merit-order dispatch).
- **One section per case** (case5, case14, case30), each with:
  - Origin/background (PJM 5-bus / IEEE 14 from AEP 1962 / IEEE 30 from AEP 1961)
  - Summary stats card (bus count by type, branch count, generator count, total load MW, total gen capacity MW) — computed at module scope from the imported `CASES` object so numbers stay accurate.
  - **Buses table**: index, type (slack/PV/PQ), Pd (MW)
  - **Branches table**: index, from, to, x (pu), rating (MW)
  - **Generators table**: index, bus, P (MW), P_min, P_max
- **Engine assumptions** section: bullet list of DC-PF caveats (no reactive, no losses, voltage violations always empty).
- **Supported actions/perturbations** section: list from `simulation-service/README.md` (scale_all_loads, set_generator_p_mw, line_outage, shed_load; load_scale, line_rating_decrease, generator_outage).
- **References** section: links to MATPOWER, PyPSA, Illinois ICSEG, plus in-repo pointers (`src/server/simulation/cases.ts`, `simulation-service/README.md`).

Implementation notes:
- Import `CASES` from `@/server/simulation/cases` (pure data, safe in client bundle — no server-only imports).
- Build a small `<CaseSection case={CASES.case5} title="case5 — 5-bus" subtitle="..." />` component inside the file to avoid repetition across the three cases.
- Tables: use plain `<table>` with Tailwind classes that fit the existing `prose prose-invert` styling in `DocsLayout` (small text, border, zebra rows via `even:bg-muted/30`). Wrap each in `<div className="overflow-x-auto">` for mobile.
- Use `tabular-nums` for numeric columns.

### 2. Edit: `src/components/docs/DocsLayout.tsx`
Add nav entry for the new page in `docsNav`, between "Architecture" and "Reproducibility":
```ts
{ to: "/docs/cases" as const, label: "Test Systems", icon: Cpu, exact: false },
```
Import `Cpu` from `lucide-react`.

### 3. Optional cross-links
Add a one-line "See [Test Systems](/docs/cases)" pointer in `docs.usage.tsx` where presets are first mentioned (low risk, improves discoverability). Skip if it complicates the diff.

## Verification
- Visit `/docs/cases` — sidebar highlights "Test Systems", all three cases render with correct counts (5/14/30 buses; 6/20/41 branches; 3/5/6 generators).
- Tables scroll horizontally on the 1050px viewport without breaking layout.
- No TS errors from importing `CASES` (it's a const object with explicit `PowerSystemCase` typing).

## Out of scope
- One-line schematic SVG diagrams (could be added later; would need hand-authored SVG per case).
- Editing `cases.ts` itself.
- Adding new cases or changing solver behavior.