---
name: Database Schema
description: All tables with RLS, FKs, and relationships for GridArena (Phase 7 reproducibility added)
type: feature
---

## Tables

- **runs** — id, title, task, agent, case_name, research_question, status (enum: queued/running/completed), user_id, **parent_run_id (self-FK, nullable)**, **rerun_source (text, nullable)**, timestamps. RLS: user_id = auth.uid().
- **run_metadata** — id, run_id (unique FK → runs CASCADE), provider fields, model fields, prompt/dataset version, random_seed, notes, **system_prompt, temperature, max_tokens, top_p, prompt_template_version, parser_version, evaluation_logic_version, benchmark_case_version, execution_timestamp** (Phase 7 — full config snapshot). RLS: via runs.user_id.
- **run_prompt_logs** — id, run_id (unique FK → runs CASCADE), prompt_text, response_text. RLS: via runs.user_id.
- **run_recommendations** — id, run_id (unique FK → runs CASCADE), recommendation_text. RLS: via runs.user_id.
- **run_parse_results** — id, run_id (unique FK → runs CASCADE), source_text, parser_notes, action_type, target_index, value, enabled. RLS: via runs.user_id.
- **run_actions** — id, run_id, action_type, target_index, value, enabled. RLS: via runs.user_id.
- **run_evaluations** — id, run_id (unique FK → runs CASCADE), feasibility, violations_found, baseline_violations, post_action_violations, violation_improvement, confidence, grounding_quality, action_applied, notes. RLS: via runs.user_id.
- **experiment_presets** — id, name, provider/model fields, prompt/dataset version, random_seed, notes, default_prompt_text, **system_prompt, temperature, max_tokens, top_p, prompt_template_version, parser_version, evaluation_logic_version** (Phase 7), user_id. RLS: user_id = auth.uid().
- **batches** — id, name, task, research_question, status, **shared_config (jsonb, Phase 7)**, user_id. RLS: user_id = auth.uid().
- **batch_run_links** — id, batch_id (FK → batches CASCADE), run_id (FK → runs CASCADE), agent, case_name, recommendation_text, UNIQUE(batch_id, run_id). RLS: via batches.user_id.

## Phase 7 conventions

- Constants: `PARSER_VERSION = "v1"`, `EVALUATION_LOGIC_VERSION = "v1"` (in src/server/runs.functions.ts and llm.functions.ts).
- `executeRunLlm` stamps `execution_timestamp`, `parser_version`, `evaluation_logic_version` on `run_metadata` before each LLM call.
- `rerunWithSameConfig` clones a run + metadata + prompt log; sets `parent_run_id` and `rerun_source = "manual"` on the new run.
- `createBatch` snapshots preset → `batches.shared_config` AND copies all preset fields into each child run's `run_metadata`.
- `RunConfigPanel` requires: model_name, system_prompt, temperature, prompt_template_version, parser_version, evaluation_logic_version → "Complete ✓" or "Partial".
