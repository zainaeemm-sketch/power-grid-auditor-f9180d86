
## Phase 10: Research Reporting & Publication-Ready Outputs

### Audit
Existing CSV export covers raw data. No print layout, no LaTeX, no narrative summaries, no chart exports. Recharts is available (used in `chart.tsx`). Routes follow flat dot convention under `_authenticated/`.

### Step 1 — Report routes (3 new pages)

Flat dot-named routes under `src/routes/_authenticated/`:
- `reports.run.$runId.tsx` — single-run report
- `reports.batch.$batchId.tsx` — full-batch report (with executive summary)
- `reports.compare.tsx` — comparison report (reads `?runs=id1,id2,...` from search params; reuses existing compare logic)

Each route has `errorComponent` + `notFoundComponent`, loads via existing server fns (`getRunDetails`, `getBatchDetails`), no new schema.

### Step 2 — Report layout component

New `src/components/reports/ReportLayout.tsx`:
- Academic styling: serif headings (Georgia/Times), generous margins, page-break CSS (`@media print`).
- Sections: Title block, Metadata/Config snapshot, Prompt & Response, Parsed Action, Evaluation Summary, Charts, Notes, Reproducibility footer (parser version, eval version, execution timestamp, parent_run_id).
- Print-only header with run/batch ID + timestamp.
- Hide app chrome (`NavHeader`) on print via `print:hidden` Tailwind utilities.

Sub-components:
- `ReportSection.tsx` — titled section wrapper with `break-inside-avoid`.
- `ReportTable.tsx` — styled comparison table (alternating rows, thin borders).
- `ReportChart.tsx` — wraps Recharts components with print-friendly colors + downloadable SVG button.

### Step 3 — Charts (Recharts)

For batch reports:
- **Violation improvement bar chart** (per run, grouped by agent).
- **Feasibility distribution pie/donut** (feasible vs infeasible vs unknown).
- **Confidence × grounding heatmap** (simple grid of counts).

For comparison reports:
- **Side-by-side metric bar chart** across selected runs.

Each chart wrapped in `ReportChart` with a "Download SVG" button (serializes the rendered `<svg>` and triggers download).

### Step 4 — Executive summary (batch)

New `src/lib/batch-summary.ts` — pure functions, no LLM:
- `bestModel(runs)` — highest mean violation_improvement grouped by `metadata.model_name`.
- `bestAgent(runs)` — same grouped by `run.agent`.
- `bestCase(runs)` — case_name with highest mean improvement.
- `robustnessNotes(runs)` — variance of improvement per model; flags high-variance models.
- `failureModes(runs)` — counts of `feasibility=infeasible`, `grounding_quality=ungrounded`, parser failures (action_type null), recurring substrings in `evaluation.notes`.

Rendered as `ExecutiveSummary.tsx` — clean prose paragraphs, not just numbers.

### Step 5 — Downloadable formats

Extend `src/lib/csv-export.ts` and add:
- `src/lib/latex-export.ts`:
  - `toLatexTable(headers, rows, caption, label)` — produces booktabs-style `\begin{table}...\end{table}` with `\toprule\midrule\bottomrule`.
  - `exportRunLatex(details)`, `exportBatchLatex(runs)`, `exportComparisonLatex(runs)` — download as `.tex`.
- `src/lib/svg-export.ts`:
  - `downloadSvg(svgEl, filename)` — serialize + trigger download.
  - `downloadPng(svgEl, filename, scale=2)` — rasterize via canvas for figure-friendly PNG.

PDF: use browser print (no library). The print stylesheet on `ReportLayout` produces clean A4 output via `window.print()`. A "Print / Save as PDF" button calls it.

### Step 6 — Report toolbar

New `src/components/reports/ReportToolbar.tsx` (sticky top, hidden on print):
- Print / Save as PDF button
- Download CSV
- Download LaTeX tables
- Download all charts (PNG zip is overkill — individual download buttons on each chart instead)
- Back to source page

### Step 7 — Wire up entry points

Add "Generate Report" buttons in:
- `src/routes/_authenticated/runs.$runId.tsx` — links to `/reports/run/$runId`.
- `src/routes/_authenticated/batches.$batchId.tsx` — links to `/reports/batch/$batchId`.
- `src/routes/_authenticated/compare.tsx` — links to `/reports/compare?runs=...`.

### Files

**Created:**
- `src/routes/_authenticated/reports.run.$runId.tsx`
- `src/routes/_authenticated/reports.batch.$batchId.tsx`
- `src/routes/_authenticated/reports.compare.tsx`
- `src/components/reports/ReportLayout.tsx`
- `src/components/reports/ReportSection.tsx`
- `src/components/reports/ReportTable.tsx`
- `src/components/reports/ReportChart.tsx`
- `src/components/reports/ReportToolbar.tsx`
- `src/components/reports/ExecutiveSummary.tsx`
- `src/lib/batch-summary.ts`
- `src/lib/latex-export.ts`
- `src/lib/svg-export.ts`

**Modified:**
- `src/routes/_authenticated/runs.$runId.tsx` (Generate Report button)
- `src/routes/_authenticated/batches.$batchId.tsx` (Generate Report button)
- `src/routes/_authenticated/compare.tsx` (Generate Report button)
- `src/styles.css` (print-specific @media rules: hide nav, A4 page setup, serif report family)
- `.lovable/memory/index.md` (note Phase 10 reporting layer)

### Stability
- No schema changes. Reports are read-only views over existing data.
- All exports are client-side (no new server fns needed).
- Each report route is independent — failure of one doesn't affect runs/batches pages.
