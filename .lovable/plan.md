
This is a substantial layer. Let me scope it tightly and present a focused plan.

## Plan: Explainability & Decision Trace Layer

### PART 1 — Schema (migration)
New table `decision_traces`:
- `id uuid pk`, `run_id uuid not null`, `sequence int not null` (for deterministic ordering)
- `stage_name text`, `stage_type text` (enum-like check: retrieval/planning/tool_use/reasoning/validation/execution/evaluation)
- `input_summary text`, `output_summary text`, `tool_name text`
- `status text` (success/warning/failure), `failure_reason text nullable`
- `execution_time_ms int`, `evidence jsonb nullable` (for Part 7)
- `created_at timestamptz default now()`
- Index on `(run_id, sequence)`
- RLS: select/insert/delete via `EXISTS (runs WHERE runs.id = run_id AND runs.user_id = auth.uid())`

### PART 2/3 — Trace capture (backend)
New file: `src/server/trace/recorder.ts` — `TraceRecorder` class with:
- `record(stage, type, input, output, tool, status, ms, evidence?)` — buffers entries with auto-incrementing sequence
- `flush(supabase, runId)` — single batch insert (deterministic, ordered)
- `failure(stage, type, reason, ms)` helper

Hook into `src/server/perturbation/run-executor.ts` (or wherever `executeRunLlm` lives) at these points:
1. Prompt received → `reasoning`
2. LLM call → `tool_use` (model name as tool)
3. Recommendation generated → `reasoning`
4. Parser → `reasoning` (input: rec text, output: action_type)
5. Action application → `execution`
6. Evaluation → `evaluation`
7. Sensitivity (only if run) → `validation`
8. Ground truth (only if available) → `evaluation`

Wrap each in try/catch — failures recorded with `status=failure` + `failure_reason`, then re-thrown so existing flow is unchanged.

### PART 4/6 — Decision Trace Viewer
New: `src/components/run-details/DecisionTracePanel.tsx`
- Loader fetches traces via new server fn `getRunTraces`
- Two views in same card: **Timeline** (horizontal bar with colored segments per stage_type, width ∝ execution_time) + **Stage list** (vertical chronological list with stage name, type badge, in/out summary, tool, status badge, time)
- Color: emerald=success, amber=warning, destructive=failure
- Replace existing mock `ToolTracePanel` usage in `runs.$runId.tsx` with this real panel (keep `ToolTracePanel` file, just stop rendering it)

### PART 5 — Failure attribution
Within `DecisionTracePanel`, if any trace has `status=failure`, show a top alert:
- Failure type (derived from stage_type: tool_use→"tool failure", reasoning→"reasoning failure", etc.)
- Reason from `failure_reason`
- Suggested explanation (static map: solver non-convergence → "Try different engine or simpler case", etc.)

### PART 7 — Evidence viewer
Per stage: if `evidence` jsonb present, show expandable `<Collapsible>` with pretty-printed JSON (retrieved docs, sim outputs, tool results).

### PART 8 — Decision explanation summary
New: `src/lib/trace-explainer.ts` — pure function `summarizeTrace(traces, evaluation)` that walks ordered stages and produces 3-5 sentences using templated strings (deterministic, no LLM call). Rendered as a `<Card>` above the timeline titled "Decision Explanation".

### PART 9 — Batch analytics
Extend `src/components/batch/BatchSensitivitySection.tsx` area in batch report (`reports.batch.$batchId.tsx`):
- New `TraceAnalyticsCard`: server fn aggregates traces for all runs in batch
- Bar chart (recharts) of failure count per stage_type
- Stat tiles: most common failure stage, avg execution time per stage

### PART 10 — Export
New: `src/lib/trace-export.ts` — `exportTraceCsv(runId, traces)` writing `trace_run_{run_id}.csv` with fields: stage_name, stage_type, status, execution_time_ms, failure_reason, input_summary, output_summary, tool_name, sequence.
Add "Export Trace CSV" button to DecisionTracePanel header.

### PART 11 — Backward compat
- All trace logging wrapped in try/catch — never blocks run execution
- Panel shows "No trace data available yet" when query returns empty array
- Existing runs without traces continue to work

### PART 12 — Seeding
On first load of a run with no traces, do NOT auto-seed (would mutate historical runs). Instead, only newly executed runs get traces. Provide a "Re-run with Same Configuration" path (already exists) for users to populate traces on old runs.

### Files (technical summary)
**New:**
- `supabase/migrations/<ts>_decision_traces.sql`
- `src/server/trace/recorder.ts` — TraceRecorder class
- `src/server/trace.functions.ts` — `getRunTraces`, `getBatchTraceAnalytics`
- `src/components/run-details/DecisionTracePanel.tsx`
- `src/components/reports/TraceAnalyticsCard.tsx`
- `src/lib/trace-explainer.ts`
- `src/lib/trace-export.ts`
- `src/types/trace.ts` (DecisionTrace type, StageType union)

**Edited:**
- `src/server/perturbation/run-executor.ts` (or actual run executor) — instrument with TraceRecorder
- `src/routes/_authenticated/runs.$runId.tsx` — render DecisionTracePanel, remove mock ToolTracePanel
- `src/types/grid-arena.ts` — re-export trace types
- `src/routes/_authenticated/reports.batch.$batchId.tsx` — add TraceAnalyticsCard
- `.lovable/memory/features/db-schema.md` — document decision_traces

### Implementation order (single message)
1. Migration (`decision_traces` table + RLS)
2. TraceRecorder + instrument executor
3. Server fns + types
4. DecisionTracePanel (timeline + list + failure alert + evidence)
5. Explanation summary + export
6. Batch analytics card
7. Wire into run details + batch report
8. Update memory

No changes to evaluation logic, parser, or simulation engines. Existing runs keep working (empty trace → "No trace data available").
