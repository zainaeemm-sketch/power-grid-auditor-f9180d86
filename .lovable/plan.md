
## Phase 7: Reproducibility & Experiment Control

A research-grade upgrade. The schema additions are the foundation; everything else flows from there. I'll build it in 6 incremental, stable steps.

### Step 1 — Schema (migration)

**Extend `experiment_presets`** (additive, nullable):
- `system_prompt text`, `temperature numeric`, `max_tokens int`, `top_p numeric`
- `prompt_template_version text`, `parser_version text`, `evaluation_logic_version text`

**Extend `run_metadata`** (additive, nullable):
- `system_prompt text`, `temperature numeric`, `max_tokens int`, `top_p numeric`
- `prompt_template_version text`, `parser_version text`, `evaluation_logic_version text`
- `benchmark_case_version text`, `execution_timestamp timestamptz`

**Extend `runs`**:
- `parent_run_id uuid` (self-ref, nullable), `rerun_source text` (nullable)

**Extend `batches`**:
- `shared_config jsonb` (nullable) — captures preset/config used at batch creation

Decision: extend `run_metadata` rather than create `run_config_snapshots`. Reason — `run_metadata` already has 1:1 unique FK to runs and is exactly the snapshot concept. Avoids dual-source-of-truth bugs. Aligns with current `RunMetadataPanel` architecture.

### Step 2 — Preset wiring

- Update `presets.tsx` form to include the new preset fields (system prompt, temp, max_tokens, top_p, versions).
- In `batches.new.tsx` and `new-run.tsx`: when a preset is selected, copy ALL preset fields into the run_metadata snapshot at creation time, and copy `system_prompt` into `run_prompt_logs.prompt_text`.

### Step 3 — LLM execution uses full config

- Update `src/server/llm.functions.ts` to read effective config from `run_metadata`: `model_name`, `system_prompt`, `temperature`, `max_tokens`, `top_p`, `random_seed`.
- Fallback chain: run_metadata field → env default (`OPENAI_MODEL`) → hardcoded sensible default.
- Stamp `execution_timestamp = now()` on `run_metadata` immediately before the API call.
- Stamp `parser_version` and `evaluation_logic_version` constants (e.g. `"v1"`) so historical runs are identifiable.

### Step 4 — Run Configuration panel + audit indicator

New `src/components/run-details/RunConfigPanel.tsx` (read-only summary card):
- Provider/model/versions/temp/max_tokens/top_p/seed/timestamp in compact 2-col layout.
- Audit footer: "Configuration: Complete ✓" or "Partial — missing: [list]". Required fields = `model_name`, `system_prompt`, `temperature`, `prompt_template_version`, `parser_version`, `evaluation_logic_version`.
- Inserted into `runs.$runId.tsx` grid above existing `RunMetadataPanel`.

The existing `RunMetadataPanel` stays as the editable surface (no UI redesign).

### Step 5 — Re-run with same configuration

- New server fn `rerunWithSameConfig({ runId })` in `runs.functions.ts`:
  1. Load source run + metadata + prompt log.
  2. Insert new run with `parent_run_id = source.id`, `rerun_source = "manual"`.
  3. Clone all metadata fields into new `run_metadata`.
  4. Clone `prompt_text` into new `run_prompt_logs`.
  5. Trigger LLM execution.
  6. Return new runId for navigation.
- Add "Re-run with Same Configuration" button to `RunStatusControls` (or as sibling next to Export CSV in `runs.$runId.tsx`).
- Show parent link badge in `RunHeader` when `parent_run_id` is set.

### Step 6 — Batch reproducibility + exports

**Batches:**
- On batch creation, snapshot the preset config to `batches.shared_config`.
- In `batches.$batchId.tsx`: compute config-consistency across child runs (compare key fields: model, temp, prompt_version, parser_version). Show badge: "All runs identical config ✓" or "⚠ N runs differ" with a popover listing the diffs.

**CSV exports** (`src/lib/csv-export.ts`):
- `exportRunCsv`: append rows for system_prompt, temperature, max_tokens, top_p, prompt_template_version, parser_version, evaluation_logic_version, benchmark_case_version, random_seed, execution_timestamp, parent_run_id.
- `exportBatchCsv`: add same per-run reproducibility columns.

### Files

**Created:**
- `src/components/run-details/RunConfigPanel.tsx`
- New migration file

**Modified:**
- `src/types/grid-arena.ts` (regen'd via Supabase types automatically)
- `src/server/runs.functions.ts` (rerun fn, extended metadata update)
- `src/server/llm.functions.ts` (use full config, stamp versions)
- `src/server/batch.functions.ts` (snapshot shared_config)
- `src/server/preset.functions.ts` (extended fields) — if exists, else `presets.tsx` direct
- `src/routes/_authenticated/runs.$runId.tsx` (mount RunConfigPanel + Re-run button)
- `src/routes/_authenticated/batches.$batchId.tsx` (consistency badge)
- `src/routes/_authenticated/batches.new.tsx` (copy preset → snapshot)
- `src/routes/_authenticated/new-run.tsx` (copy preset → snapshot)
- `src/routes/_authenticated/presets.tsx` (extended form fields)
- `src/components/run-details/RunMetadataPanel.tsx` (extended editable fields)
- `src/components/run-details/RunHeader.tsx` (parent_run_id link)
- `src/lib/csv-export.ts` (extended fields)
- `.lovable/memory/features/db-schema.md` (document additions)

### Stability strategy

All schema changes additive + nullable → existing runs/presets continue working with NULL values shown as "—" in the config panel and marked "Partial" by the audit indicator. No data backfill required. Each step is shippable independently.
