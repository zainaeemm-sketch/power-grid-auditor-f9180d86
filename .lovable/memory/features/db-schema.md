---
name: Database Schema
description: All tables with RLS, FKs, and relationships for GridArena (Phase 7 + Ground Truth + Decision Traces)
type: feature
---

## Tables

- **runs** — id, title, task, agent, case_name, research_question, status, user_id, parent_run_id, rerun_source, ground_truth_scenario_id (uuid, nullable), timestamps. RLS: user_id = auth.uid().
- **run_metadata / run_prompt_logs / run_recommendations / run_parse_results / run_actions / run_evaluations** — all keyed to runs (cascade), RLS via runs.user_id.
- **experiment_presets / batches / batch_run_links** — user-scoped RLS.
- **ground_truth_scenarios / ground_truth_actions** — user-scoped + is_public flag.
- **perturbation_tests / perturbation_results** — sensitivity layer, RLS via parent run.
- **decision_traces** (NEW — Explainability layer) — id, run_id (FK runs CASCADE), sequence (int, deterministic order), stage_name, stage_type CHECK IN (retrieval/planning/tool_use/reasoning/validation/execution/evaluation), input_summary, output_summary, tool_name, status CHECK IN (success/warning/failure), failure_reason, execution_time_ms, evidence (jsonb), created_at. Index on (run_id, sequence). RLS: select/insert/delete via runs.user_id.
- **job_queue / job_logs / validation_results / user_approvals / user_roles** — unchanged.

## Decision Trace layer

- `TraceRecorder` (src/server/trace/recorder.ts) buffers entries during run execution, flushes single batch insert at end. Failures swallowed — never block run.
- `executeRunLlm` instrumented at: prompt received (reasoning), LLM invocation (tool_use), recommendation (reasoning), parser (reasoning), action application (execution), evaluation (evaluation), ground-truth comparison (evaluation).
- Server fns: `getRunTraces`, `getBatchTraceAnalytics` in `src/server/trace.functions.ts`.
- UI: `DecisionTracePanel` on run details (timeline + stage list + failure alert + evidence collapsibles + CSV export); `TraceAnalyticsCard` on batch report (failure-by-stage + avg time bar charts).
- Backward compat: empty trace → "No trace data available yet". Old runs unaffected.
