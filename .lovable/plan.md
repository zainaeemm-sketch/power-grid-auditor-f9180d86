
User wants edit + delete actions on dashboard list pages so they can curate/clean their data. Cascading deletes already work via existing RLS-scoped DELETE policies on child tables, but I should explicitly delete child rows in server fns to be safe (no FK cascade defined).

## Plan: Edit & Delete actions across dashboards

### Scope
Add row-level **Edit** and **Delete** actions to:
1. **Runs** (`/runs`) — delete + inline-edit title
2. **Presets** (`/presets`) — delete + edit (name, model, system_prompt, temperature, etc.)
3. **Batches** (`/batches`) — delete + edit (name, research_question)
4. **Ground Truth scenarios** (`/ground-truth`) — delete (edit page already exists)
5. **Validation results** (`/validation`) — delete individual + "Clear all" button

All destructive actions go through `AlertDialog` confirmation.

### Server functions (new / updated)

**`src/server/runs.functions.ts`**
- `deleteRun({ run_id })` — deletes child rows first (decision_traces, run_metadata, run_prompt_logs, run_recommendations, run_parse_results, run_evaluations, run_actions, perturbation_tests→results, batch_run_links), then `runs` row. RLS guarantees user-scoped.
- `updateRun({ run_id, title?, research_question? })`
- `deletePreset({ preset_id })`
- `updatePreset({ preset_id, ...fields })`

**`src/server/batch.functions.ts`**
- `deleteBatch({ batch_id })` — delete batch_run_links then batch
- `updateBatch({ batch_id, name?, research_question? })`

**`src/server/ground-truth.functions.ts`**
- `deleteScenario({ scenario_id })` — delete actions then scenario (likely already exists; verify and add if missing)

**`src/server/validation.functions.ts`**
- `deleteValidationResult({ id })`
- `clearValidationResults()` — delete all for current user

### UI changes

Pattern per list page: add an **Actions** column (or dropdown menu) with Edit (pencil) + Delete (trash) icons. Delete opens `AlertDialog`. Edit opens a `Dialog` with a small form, or navigates to existing edit route where one exists.

- **`src/routes/_authenticated/runs.index.tsx`** — Actions column, edit dialog (title only), delete confirm
- **`src/routes/_authenticated/presets.tsx`** — Actions, edit dialog reusing preset fields, delete confirm
- **`src/routes/_authenticated/batches.index.tsx`** — Actions, edit dialog, delete confirm
- **`src/routes/_authenticated/ground-truth.index.tsx`** — Delete confirm (edit already routes to `/ground-truth/edit/$id`)
- **`src/routes/_authenticated/validation.tsx`** — Per-row delete + "Clear all results" button in toolbar

After mutations: invalidate router (`router.invalidate()`) and toast success/error.

### Safety
- All deletes wrapped in `AlertDialog` with explicit "This cannot be undone" copy.
- Server fns use the authed Supabase client → RLS enforces ownership; even if user_id spoofed, RLS blocks.
- Cached AI explanations live on `runs` row → removed automatically with run delete.

### Non-goals
- No bulk multi-select delete (can be a follow-up).
- No soft-delete / undo.
- No schema changes.
