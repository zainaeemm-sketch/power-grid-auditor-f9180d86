

# Phase 1 Audit: What's Implemented vs What's Missing

## Fully Implemented

| Requirement | Status |
|---|---|
| Dark professional research-dashboard design | Done — slate bg, emerald primary |
| Responsive layouts (desktop/laptop first) | Done |
| NavHeader with Home, Runs, New Run, Presets, Batches, Compare | Done |
| Home page — hero, CTA buttons, overview cards | Done |
| Runs page — reverse chronological list, title/task/agent/case/status/time | Done |
| Runs page — search box (filters by title, agent, task) | Done |
| Runs page — each card links to run details | Done |
| New Run page — form with title, task, agent, case, research question | Done |
| New Run page — preset dropdown that auto-fills agent | Done |
| New Run page — on submit: creates run, saves preset metadata + prompt, redirects | Done |
| Supabase backend with auth (email/password) | Done |
| Row-level security on all tables | Done |
| Server-side functions for all data access | Done |
| Secrets for API keys (not exposed to frontend) | Done |
| Run Details page with all panels (metadata, prompt, recommendation, parser, action, results, tool trace, provenance timeline) | Done |
| Run status controls | Done |
| Editable metadata and prompt panels | Done |
| "Run LLM Automatically" button (server-side execution) | Done |
| Parser provenance (rule-based, 4 action types) | Done |
| Results summary / evaluation engine (placeholder) | Done |
| Presets page — create form + list + card layout | Done |
| Compare page — select two runs, side-by-side comparison | Done |
| Batches page — create/list/detail, analytics cards, charts | Done |
| Run-level CSV export | Done |
| Comparison CSV export | Done |
| Batch analytics CSV export | Done |
| Seed data (6 runs exist) | Done |

## Missing / Gaps

| Requirement | Gap |
|---|---|
| **`run_actions` table** | The spec lists a separate `run_actions` table (id, run_id, action_type, target_index, value, enabled). This table does NOT exist. Currently `run_parse_results` stores both parser output and the structured action in one table. |
| **`batch_run_links` columns** | The spec says `batch_run_links` should have `agent`, `case_name`, `recommendation_text` columns. The current table only has `id`, `batch_id`, `run_id`, `created_at`. These extra columns are denormalized copies; the app works without them by joining through `runs`, but it doesn't match the spec exactly. |
| **Runs page filters** | The spec says "Add search and filters for task, agent, case, status." Currently only a single search box exists. There are no dedicated dropdown/select filters for task, agent, case, or status individually. |

## Assessment

The vast majority of Phase 1 through Phase 6 features are implemented and working. The three gaps above are minor:

1. **`run_actions`** — a design decision was made to merge it with `run_parse_results`. Creating a separate table would add a migration + code changes but no new user-facing capability.
2. **`batch_run_links` extra columns** — these are denormalized fields. The app already fetches run data via joins, so the functionality works; only the schema shape differs from spec.
3. **Runs page filters** — adding dedicated filter dropdowns for task, agent, case, and status would improve usability and match the spec.

## Recommended Fix Plan

### 1. Add filter dropdowns to the Runs page
- Add `Select` dropdowns above the run list for: Task, Agent, Case, Status
- Dynamically populate options from the loaded runs data
- Apply filters alongside the existing search box

### 2. Create `run_actions` table (optional — spec compliance)
- Migration: create `run_actions` (id, run_id, action_type, target_index, value, enabled, created_at, updated_at) with RLS
- Update `createRun` and `executeRunLlm` to also insert into `run_actions` after parsing
- Add a `StructuredActionPanel` data source from this table (currently reads from `run_parse_results`)

### 3. Add missing `batch_run_links` columns (optional — spec compliance)
- Migration: add `agent`, `case_name`, `recommendation_text` to `batch_run_links`
- Update batch creation/linking code to populate these columns

### Files affected
| File | Change |
|---|---|
| `src/routes/_authenticated/runs.index.tsx` | Add filter dropdowns |
| Migration SQL | `run_actions` table + RLS (if desired) |
| Migration SQL | `batch_run_links` extra columns (if desired) |
| `src/server/runs.functions.ts` | Write to `run_actions` on LLM execution |
| `src/server/batch.functions.ts` | Populate denormalized fields on link creation |
| `src/types/grid-arena.ts` | Add `RunAction` type |

No changes needed for features that are already working. Should I proceed with all three fixes, or just the filters (the only user-visible gap)?

