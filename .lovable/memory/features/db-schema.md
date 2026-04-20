---
name: Database Schema
description: All tables with RLS, FKs, and relationships for GridArena (Phases 7-10 + Ground Truth + Decision Traces + Counterfactual)
type: feature
---

## Tables

- **runs** — id, title, task, agent, case_name, research_question, status, user_id, parent_run_id, rerun_source, ground_truth_scenario_id, timestamps. RLS: user_id = auth.uid().
- **run_metadata / run_prompt_logs / run_recommendations / run_parse_results / run_actions / run_evaluations** — keyed to runs (cascade), RLS via runs.user_id.
- **experiment_presets / batches / batch_run_links** — user-scoped RLS.
- **ground_truth_scenarios / ground_truth_actions** — user-scoped + is_public flag.
- **perturbation_tests / perturbation_results** — sensitivity layer, RLS via parent run.
- **decision_traces** — explainability layer; sequence-ordered stage entries with evidence jsonb.
- **counterfactual_actions** (NEW — Layer E) — id, run_id, action_type, target_index, value, description, source ('default'|'custom'), created_at. RLS via runs.user_id.
- **counterfactual_results** (NEW — Layer E) — id, counterfactual_action_id, baseline_action_type, counterfactual_action_type, baseline_/counterfactual_ feasibility & violations & improvement, violation_difference, improvement_difference, optimality_gap, decision_regret, feasibility_change ('improved'|'unchanged'|'worsened'), status, failure_reason, execution_time_ms. RLS via counterfactual_actions → runs.
- **job_queue / job_logs / validation_results / user_approvals / user_roles / user_preferences** — unchanged.

## Counterfactual layer

- Server fns: `listCounterfactuals`, `runDefaultCounterfactuals`, `addCustomCounterfactual`, `runBatchCounterfactuals`, `getBatchCounterfactualSummary` in `src/server/counterfactual.functions.ts`.
- Engine: `src/server/counterfactual/{types,defaults,execute}.ts`. Uses in-Worker DC PF (deterministic). Defaults are contextual to baseline action type.
- UI: `CounterfactualPanel` (run details), `BatchCounterfactualSection` (batch detail). CSV exports in `src/lib/csv-export.ts`.
- Backward compat: empty list → "No counterfactual analysis executed".
