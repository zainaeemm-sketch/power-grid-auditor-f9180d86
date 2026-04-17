---
name: Database Schema
description: All tables with RLS, FKs, and relationships for GridArena (Phase 7 + Ground Truth layer)
type: feature
---

## Tables

- **runs** — id, title, task, agent, case_name, research_question, status, user_id, parent_run_id (self-FK, nullable), rerun_source, **ground_truth_scenario_id (uuid, nullable, soft link — no FK)**, timestamps. RLS: user_id = auth.uid().
- **run_metadata** — provider/model/prompt/dataset versions, system_prompt, temperature, max_tokens, top_p, parser_version, evaluation_logic_version, benchmark_case_version, execution_timestamp. FK unique → runs CASCADE. RLS: via runs.user_id.
- **run_prompt_logs** — prompt_text, response_text. FK unique → runs CASCADE.
- **run_recommendations** — recommendation_text. FK unique → runs CASCADE.
- **run_parse_results** — source_text, parser_notes, action_type, target_index, value, enabled. FK unique → runs CASCADE.
- **run_actions** — action_type, target_index, value, enabled.
- **run_evaluations** — feasibility, violations_found, baseline_violations, post_action_violations, violation_improvement, confidence, grounding_quality, action_applied, notes, engine_used, simulation_details, **action_match, feasibility_match, optimality_gap, deviation_from_reference, evaluation_against_ground_truth (Ground Truth layer, all nullable/default false)**. FK unique → runs CASCADE.
- **experiment_presets** — full config + default_prompt_text. RLS: user_id = auth.uid().
- **batches** — name, task, research_question, status, shared_config (jsonb). RLS: user_id = auth.uid().
- **batch_run_links** — batch_id, run_id, agent, case_name, recommendation_text, UNIQUE(batch_id, run_id).
- **ground_truth_scenarios** — scenario_id (unique per user), case_name, scenario_description, difficulty_level, user_id. RLS: user_id = auth.uid().
- **ground_truth_actions** — scenario_id (FK → ground_truth_scenarios CASCADE), action_type, target_index, value, expected_feasibility, expected_violations, expected_violation_improvement, notes. RLS: via parent scenario.user_id.
- **job_queue / job_logs / validation_results** — unchanged (phase 10).

## Ground Truth layer conventions

- `runs.ground_truth_scenario_id` is optional; when set, `executeRunLlm` loads reference actions and calls `compareToGroundTruth()` (src/server/ground-truth/compare.ts), writing `action_match` (exact/partial/none), `feasibility_match`, `optimality_gap`, `deviation_from_reference`, `evaluation_against_ground_truth = true` onto `run_evaluations`.
- Server functions: `listScenarios`, `getScenario`, `createScenario`, `deleteScenario`, `seedExampleScenarios` in `src/server/ground-truth.functions.ts`.
- UI: `/ground-truth` list, `/ground-truth/new`, `/ground-truth/$id`; `GroundTruthComparisonPanel` on run details; accuracy chart in batch reports.
- Backward compat: all new columns nullable, panel shows "No ground truth available" when absent.
