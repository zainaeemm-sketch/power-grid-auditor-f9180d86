---
name: Database Schema
description: All tables with RLS, FKs, and relationships for GridArena
type: feature
---

## Tables

- **runs** — id, title, task, agent, case_name, research_question, status (enum: queued/running/completed), user_id, timestamps. RLS: user_id = auth.uid().
- **run_metadata** — id, run_id (unique FK → runs CASCADE), provider fields, model fields, prompt/dataset version, random_seed, notes. RLS: via runs.user_id.
- **run_prompt_logs** — id, run_id (unique FK → runs CASCADE), prompt_text, response_text. RLS: via runs.user_id.
- **run_recommendations** — id, run_id (unique FK → runs CASCADE), recommendation_text. RLS: via runs.user_id.
- **run_parse_results** — id, run_id (unique FK → runs CASCADE), source_text, parser_notes, action_type, target_index, value, enabled. RLS: via runs.user_id.
- **run_actions** — id, run_id, action_type, target_index, value, enabled. RLS: via runs.user_id. Stores structured actions derived from parser.
- **run_evaluations** — id, run_id (unique FK → runs CASCADE), feasibility, violations_found, baseline_violations, post_action_violations, violation_improvement, confidence, grounding_quality, action_applied, notes. RLS: via runs.user_id.
- **experiment_presets** — id, name, provider/model fields, prompt/dataset version, random_seed, notes, default_prompt_text, user_id. RLS: user_id = auth.uid().
- **batches** — id, name, task, research_question, status (text: queued/running/completed), user_id. RLS: user_id = auth.uid().
- **batch_run_links** — id, batch_id (FK → batches CASCADE), run_id (FK → runs CASCADE), agent, case_name, recommendation_text, UNIQUE(batch_id, run_id). RLS: via batches.user_id.

All tables have created_at, updated_at with auto-update triggers.
