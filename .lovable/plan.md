

# Phase 5: Action Application, Evaluation Logic, and Parser Provenance

## Overview

Add a deterministic action-application and evaluation pipeline that transforms a parsed action into a structured evaluation summary, making each run feel like a complete research experiment. All logic is computed server-side; results are persisted in a new `run_evaluations` table for comparison readiness.

## Step 1: Create `run_evaluations` table

New migration adding:

```sql
CREATE TABLE public.run_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL UNIQUE REFERENCES runs(id) ON DELETE CASCADE,
  feasibility text NOT NULL DEFAULT 'unknown',
  violations_found integer NOT NULL DEFAULT 0,
  baseline_violations integer NOT NULL DEFAULT 10,
  post_action_violations integer NOT NULL DEFAULT 10,
  violation_improvement numeric NOT NULL DEFAULT 0,
  confidence text NOT NULL DEFAULT 'low',
  grounding_quality text NOT NULL DEFAULT 'none',
  action_applied text NOT NULL DEFAULT 'No action applied',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE run_evaluations ENABLE ROW LEVEL SECURITY;
-- RLS policies: SELECT/INSERT/UPDATE/DELETE via runs.user_id = auth.uid()
-- Auto-update trigger on updated_at
```

## Step 2: Action application + evaluation logic

New file `src/server/evaluation.functions.ts` containing:

- **`applyParsedAction(parseResult)`** — pure function that interprets a parse result and returns `{ action_applied, application_status, application_notes }`. Deterministic rules:
  - `none` → no action, status "skipped"
  - `scale_all_loads` → "Scaled all loads by factor X", status "success" if value valid
  - `set_generator_p_mw` → "Set generator N to X MW", status "success" if both fields valid
  - `line_outage` → "Took line N out of service", status "success" if target_index valid
  - Invalid/missing fields → status "failed" with descriptive notes

- **`computeEvaluation(parseResult, actionResult)`** — pure function returning evaluation summary fields. Rule-based logic:
  - Baseline violations = 10 (fixed placeholder)
  - `scale_all_loads` with factor < 1: improvement = 2, post = 8
  - `scale_all_loads` with factor >= 1: improvement = -1, post = 11
  - `set_generator_p_mw`: improvement = 1, post = 9
  - `line_outage`: improvement = -3, post = 13
  - `none` or failed application: improvement = 0, post = 10
  - Feasibility: "feasible" if action succeeded, "infeasible" if failed, "not_applicable" if none
  - Confidence: "high" if action matched and applied, "medium" if matched but failed, "low" if none
  - Grounding quality: "grounded" if source_text present and action matched, "ungrounded" otherwise

- **`evaluateRun` server function** — loads parse result, calls both functions, upserts into `run_evaluations`, returns result.

## Step 3: Improve parser provenance text

Update `parseRecommendationText` in `llm.functions.ts` with richer `parser_notes`:
- `"Matched load scaling rule from phrase '...' and extracted factor 0.95."`
- `"Matched generator dispatch rule and extracted generator 2 with target 120 MW."`
- `"Matched line outage rule for line 4 from phrase '...'."`
- `"No supported control action pattern found in recommendation text, defaulted to action_type='none'."`

Also add `reduce ... loads by X%` pattern (extracts factor as `1 - X/100`).

## Step 4: Wire evaluation into LLM execution pipeline

Update `executeRunLlm` in `llm.functions.ts`:
- After saving parse result (step 8), call `evaluateRun` to compute and persist the evaluation.
- Return evaluation data alongside existing response.

## Step 5: Update types

Add to `src/types/grid-arena.ts`:
```typescript
export interface RunEvaluation {
  id: string; run_id: string; feasibility: string;
  violations_found: number; baseline_violations: number;
  post_action_violations: number; violation_improvement: number;
  confidence: string; grounding_quality: string;
  action_applied: string; notes: string | null;
  created_at: string; updated_at: string;
}
```
Add `evaluation: RunEvaluation | null` to `RunDetails`.

## Step 6: Update `getRunDetails` loader

Fetch `run_evaluations` row alongside other data and include in returned `RunDetails`.

## Step 7: Update UI panels

**ResultsSummaryPanel** — accept `evaluation: RunEvaluation | null` prop. Show actual values with colored badges (green for feasible/high, yellow for medium, red for infeasible/low). Graceful "Pending" fallback when null.

**StructuredActionPanel** — already works, no changes needed.

**ParserProvenancePanel** — already displays parser_notes; richer text flows through automatically.

**RunDetailPage** — pass `evaluation` to `ResultsSummaryPanel`.

## Step 8: Recompute on manual recommendation edit

Add a "Reparse & Evaluate" button to `RunRecommendationPanel` that:
1. Parses current recommendation text
2. Saves parse result
3. Calls `evaluateRun`
4. Calls `router.invalidate()`

## Files Changed

| File | Change |
|------|--------|
| New migration | `run_evaluations` table with RLS |
| `src/server/evaluation.functions.ts` | New: `applyParsedAction`, `computeEvaluation`, `evaluateRun` |
| `src/server/llm.functions.ts` | Improve parser notes; call evaluation after parse |
| `src/types/grid-arena.ts` | Add `RunEvaluation`, update `RunDetails` |
| `src/server/runs.functions.ts` | Fetch `run_evaluations` in `getRunDetails` |
| `src/components/run-details/ResultsSummaryPanel.tsx` | Accept and display evaluation data |
| `src/components/run-details/RunRecommendationPanel.tsx` | Add "Reparse & Evaluate" button |
| `src/routes/_authenticated/runs.$runId.tsx` | Pass evaluation prop |

