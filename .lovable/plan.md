

# Phase 6: Batch Experiments, Comparison, Charts, and CSV Export

## Overview

This phase adds batch experiment management, multi-run execution, comparison analytics with charts, and CSV export. It builds on the existing run/evaluation pipeline from Phases 1-5.

## Step 1: Database — `batches` and `batch_run_links` tables

Two new tables via migration:

```sql
CREATE TABLE public.batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  task text NOT NULL,
  research_question text,
  status text NOT NULL DEFAULT 'queued',  -- queued | running | completed
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.batch_run_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(batch_id, run_id)
);
```

Both tables get RLS policies scoped via `user_id` (batches) or via `batches.user_id` (batch_run_links). Auto-update trigger on `batches.updated_at`.

## Step 2: Types — `src/types/grid-arena.ts`

Add `Batch` and `BatchRunLink` interfaces. Add `BatchDetails` type containing batch, linked runs with their evaluations.

## Step 3: Server functions — `src/server/batch.functions.ts`

New file with:

- **`listBatches`** — fetch user's batches with run count
- **`getBatchDetails`** — fetch batch + linked runs + their evaluations (joined)
- **`createBatch`** — accepts name, task, research_question, agents[], cases[], preset_id?; creates batch record, then creates N runs (agents x cases) and links them
- **`executeBatchRuns`** — sequentially executes `executeRunLlm` for each incomplete run in the batch; updates batch status; returns progress/results
- **`getBatchAnalytics`** — computes comparison metrics (feasibility rate, avg improvement, per-agent/per-case breakdowns) from evaluations

## Step 4: Batch list page — `src/routes/_authenticated/batches.index.tsx`

Replace sample data with real loader calling `listBatches`. Show batch cards with name, task, run count, status badge. "New Batch" button links to `/batches/new`.

## Step 5: Batch creation page — `src/routes/_authenticated/batches.new.tsx`

New route with form:
- Batch name, task, research question inputs
- Multi-select for agents (text input, comma-separated or chip-style)
- Multi-select for cases
- Optional preset selector
- "Create Batch" button that calls `createBatch` and navigates to batch detail

## Step 6: Batch details page — `src/routes/_authenticated/batches.$batchId.tsx`

Full rewrite with:
- **Header**: batch name, task, research question, status badge, created date
- **Progress bar**: completed/total runs
- **"Run All Experiments" button**: calls `executeBatchRuns`, shows progress
- **Summary cards**: total runs, completed, avg feasibility, avg improvement, best/worst agent
- **Run table**: columns for run title, agent, case, status, feasibility, violation improvement, confidence — each row links to run detail
- **Comparison table**: agent-level aggregation (runs, feasibility %, avg improvement, avg confidence, avg grounding)
- **Charts section** (4 charts using recharts + existing chart.tsx wrapper):
  1. Violation improvement by agent (bar)
  2. Feasibility rate by agent (bar)
  3. Confidence vs grounding scatter
  4. Case-level performance (bar)
- **Export buttons**: Export Batch CSV, Export Comparison CSV

## Step 7: CSV Export utilities — `src/lib/csv-export.ts`

Pure client-side functions:
- `exportBatchCsv(runs, evaluations)` — generates batch CSV with all specified fields
- `exportRunCsv(runDetails)` — generates single-run CSV
- `exportComparisonCsv(runs, evaluations)` — generates comparison CSV
- Helper: `downloadCsv(content, filename)` — creates blob and triggers download

Add "Export Run CSV" button to the run detail page.

## Step 8: Compare page update — `src/routes/_authenticated/compare.tsx`

Wire up with real data:
- Load runs list via `listRuns`
- When two runs selected, fetch both via `getRunDetails`
- Display side-by-side: metadata, recommendation, parsed action, evaluation
- Add "Export Comparison CSV" button

## Step 9: Update memory

Update `mem://features/db-schema` with new tables.

## Files Changed

| File | Change |
|------|--------|
| New migration | `batches` + `batch_run_links` tables with RLS |
| `src/types/grid-arena.ts` | Add Batch, BatchRunLink, BatchDetails types |
| `src/server/batch.functions.ts` | New: all batch server functions |
| `src/lib/csv-export.ts` | New: CSV generation utilities |
| `src/routes/_authenticated/batches.index.tsx` | Real data, loader |
| `src/routes/_authenticated/batches.new.tsx` | New: batch creation form |
| `src/routes/_authenticated/batches.$batchId.tsx` | Full batch detail with analytics + charts |
| `src/routes/_authenticated/compare.tsx` | Wire up with real data |
| `src/routes/_authenticated/runs.$runId.tsx` | Add "Export Run CSV" button |
| `mem://features/db-schema` | Add batch tables |

## Implementation Order

1. Migration (tables + RLS)
2. Types
3. Server functions
4. CSV utilities
5. Batch list page (with loader)
6. Batch creation page
7. Batch details page (runs table + execution + analytics + charts)
8. Compare page update
9. Run detail CSV export button

