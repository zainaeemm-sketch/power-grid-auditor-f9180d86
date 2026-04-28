## Goal

Bring the website's written content in line with the v5 DOCX report. Add the LLM-tools-landscape narrative, GridArena's positioning, a comparison-at-a-glance table, and the 2025–2026 reference list to `/docs` and `/about`. No theme or visual changes.

## What changes

### 1. New docs page: `/docs/landscape`
A new route `src/routes/docs.landscape.tsx` containing the v5 report content:

- **Purpose** — why an evaluation/benchmarking layer is needed for LLM-based grid agents.
- **Current LLM tools in power systems operation** — short profile for each tool covering:
  - Purpose
  - Required inputs / expected outputs
  - Decisions or recommendations generated
  - Operational scope and limitations
  Tools covered: Grid-Agent, GridMind, GAIA, PowerDAG (with reference numbers matching the bibliography).
- **How GridArena fits in** — positioned as an evaluation/benchmarking platform addressing physical feasibility (PyPSA AC/DC loop), robustness (counterfactual + perturbation jobs), and reasoning/tool-use failure modes (LLM-as-judge, parser provenance, decision traces).
- **Comparison at a glance** — a table with one row per tool plus a GridArena row, columns for Category, Inputs, Outputs, Scope, and Reference number. Each row's reference number maps 1:1 to the bibliography below.
- **References** — the 24 verified 2025–2026 entries from v5 (arXiv IDs and DOIs preserved), rendered as a numbered list.

Add a "Landscape" entry to the docs sidebar (`src/components/docs/DocsLayout.tsx`) between Overview and Installation.

### 2. `/docs` overview update
Add a short paragraph linking to the new Landscape page so readers discover it from the overview. Keep existing structure intact.

### 3. `/about` update
Insert two new sections before "Authors & affiliation":

- **Landscape & positioning** — 2–3 paragraphs summarising how GridArena differs from operational agents (Grid-Agent, GridMind, GAIA, PowerDAG) and what evaluation gap it fills. Link to `/docs/landscape` for the full treatment.
- **Selected references** — a condensed list of ~6 of the most important references, with a "See all 24 references" link to `/docs/landscape#references`.

## What does NOT change

- No theme, color, or layout changes (per your earlier rejections of the theme proposals).
- No changes to `src/lib/citation.ts`, auth, DB schema, or server functions.
- The DOCX report on disk is untouched.

## Technical notes

- New route file `src/routes/docs.landscape.tsx` follows the existing `createFileRoute` pattern used by sibling docs pages — `routeTree.gen.ts` regenerates automatically.
- The comparison table uses a plain semantic `<table>` styled by the existing `prose` rules in `DocsLayout`; no new components needed.
- References rendered as an `<ol>` with `id="references"` so in-page anchors work from the table and from `/about`.
- Reference content is sourced verbatim from `/mnt/documents/GridArena_Overview_Report_v5.docx` to guarantee 1:1 alignment with the report you already approved.

## Files touched

- `src/routes/docs.landscape.tsx` (new)
- `src/components/docs/DocsLayout.tsx` (add sidebar entry)
- `src/routes/docs.index.tsx` (link to new page)
- `src/routes/about.tsx` (two new sections)
