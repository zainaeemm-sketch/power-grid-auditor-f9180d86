

# Phase 2: Backend CRUD & Persistence

## Current State

Tables already exist: `runs`, `run_metadata`, `run_prompt_logs`, `experiment_presets` — all with user-scoped RLS. Server functions exist for `listRuns`, `getRun`, `createRun`, `listPresets`.

Missing: `run_recommendations` and `run_parse_results` tables. The Run Details page is placeholder-only. No update server functions exist. No preset creation. No foreign keys on child tables.

## Step 1: Database Migration

Create two new tables and add foreign keys to existing child tables:

**New tables:**
- `run_recommendations` (id, run_id unique FK → runs, recommendation_text, created_at, updated_at) with user-scoped RLS via runs join
- `run_parse_results` (id, run_id unique FK → runs, source_text, parser_notes, action_type, target_index, value, enabled default true, created_at, updated_at) with user-scoped RLS via runs join

**Schema fixes:**
- Add foreign key constraints on `run_metadata.run_id → runs.id ON DELETE CASCADE`
- Add foreign key constraint on `run_prompt_logs.run_id → runs.id ON DELETE CASCADE`
- Add unique constraints on `run_metadata.run_id` and `run_prompt_logs.run_id` (one per run)

## Step 2: New Server Functions

Add to `src/server/runs.functions.ts`:

- `getRunDetails` — fetches run + metadata + prompt log + recommendation + parse result in one call (individual queries, graceful nulls for missing rows)
- `updateRunMetadata` — upsert run_metadata for a run
- `updatePromptLog` — upsert run_prompt_logs for a run
- `updateRecommendation` — upsert run_recommendations for a run
- `updateRunStatus` — update runs.status
- `createPreset` — insert into experiment_presets with user_id

Add types to `src/types/grid-arena.ts`:
- `RunRecommendation`, `RunParseResult`

## Step 3: Wire Run Details Page

Replace placeholder panels in `runs.$runId.tsx` with real data:

- **Loader**: call `getRunDetails({ data: { runId } })`
- **Metadata panel**: editable form (provider, model, prompt version, dataset version, seed, notes) with Save button calling `updateRunMetadata`
- **Prompt/Response panel**: two textareas with Save button calling `updatePromptLog`
- **Recommendation panel**: textarea with Save button calling `updateRecommendation`
- **Parser Provenance panel**: read-only display from `run_parse_results`, fallback "No parse results yet"
- **Status controls**: buttons to change status (queued → running → completed) calling `updateRunStatus`
- **Run header**: show real title, agent, status from loaded data

## Step 4: Wire Presets Page

- Add a "New Preset" dialog/form with all fields
- On submit, call `createPreset` server function
- Refresh preset list after creation

## Step 5: Ensure createRun Also Creates Recommendation Row

Update `createRun` to also insert an empty `run_recommendations` row alongside metadata and prompt log rows.

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | New tables, FKs, unique constraints, RLS |
| `src/types/grid-arena.ts` | Add RunRecommendation, RunParseResult types |
| `src/server/runs.functions.ts` | Add getRunDetails, update*, createPreset functions |
| `src/routes/_authenticated/runs.$runId.tsx` | Full rewrite with loader + editable panels |
| `src/routes/_authenticated/presets.tsx` | Add create preset form/dialog |
| `src/routes/_authenticated/new-run.tsx` | Minor: also create recommendation row |

