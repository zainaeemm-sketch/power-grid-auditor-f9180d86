

## Revised plan: AI Assist for Batches first, shared agent source, soft cap

Folds in the three refinements from the previous reply. Same OpenAI-compatible endpoint already used by `/new-run` (`OPENAI_API_KEY` + `OPENAI_BASE_URL` + `OPENAI_MODEL`). No Lovable AI, no new keys.

### Ship order

**Phase 1 — Shared allowed-values source** (small refactor, unblocks the rest)
**Phase 2 — Batches AI Assist** (highest value)
**Phase 3 — Presets AI Assist** (collapsed/optional, lowest value)

Each phase is independently shippable.

---

### Phase 1 — Shared allowed-values source

Single source of truth so adding an agent or case only requires editing one file.

- **New** `src/lib/allowed-values.ts` exporting:
  - `ALLOWED_CASES = ["case5", "case14", "case30"] as const` + `AllowedCase` type
  - `ALLOWED_AGENTS = [...] as const` + `AllowedAgent` type — initial list seeded from current usage (`poweragent`, `powerfm`, `gridgpt`, `gpt-4o`, `claude-3.5`); confirmed against existing batch/run code during exploration
  - `ALLOWED_EVALUATION_MODES = ["rule_based", "simulation", "auto"] as const`
  - Helper `isAllowedAgent(x)` / `isAllowedCase(x)` for runtime checks
- **Edit** `src/server/scenario-assist.functions.ts` — import `ALLOWED_CASES` and build the case enum from it instead of the hard-coded array currently in the tool schema.
- No UI changes in this phase.

When custom user cases land later, only `allowed-values.ts` (or a small loader that merges built-ins + user cases) changes — every assist function picks it up automatically.

---

### Phase 2 — Batches AI Assist

Mounted at the top of `/batches/new`, above the Batch Configuration card.

User types e.g. *"compare three agents on IEEE 14-bus and 30-bus under load scaling"* → AI returns suggested batch config.

**Suggested fields**: `name`, `task`, `research_question`, `agents[]` (constrained to `ALLOWED_AGENTS`), `cases[]` (constrained to `ALLOWED_CASES`), `rationale`. Returned as comma-joined strings to match the existing form inputs.

**Apply flow** (mirrors new-run):
- Empty form → apply directly.
- Any field filled → single `AlertDialog` summary modal with per-field diff (NEW vs OVERWRITE badges, current struck-through vs new).

**Validation before Apply**:
- name 1–80, task 1–60
- ≥ 1 agent, ≥ 1 case
- every agent ∈ `ALLOWED_AGENTS`, every case ∈ `ALLOWED_CASES`
- **Total runs (`agents × cases`) > 50 → soft yellow warning, not a hard block.** User can Apply anyway. Hard block only if total runs is 0 or > 500 (sanity ceiling).
- Inline destructive alert on hard failures, inline yellow alert for the soft cap.

**Files**:
- **New** `src/server/batch-assist.functions.ts` — `suggestBatch` server fn. Same OpenAI call pattern, error codes, and auth wrapping as `scenario-assist.functions.ts`. Tool schema = `propose_batch` with `agents` / `cases` as `string[]` whose `items.enum` is built from `ALLOWED_AGENTS` / `ALLOWED_CASES` at request time.
- **New** `src/components/batch/BatchAssistCard.tsx` — textarea + Suggest button + preview card with Apply / Discard / Regenerate. Footer: *"Suggested by `{OPENAI_MODEL}` via your configured OpenAI endpoint"*. Three example prompts.
- **Edit** `src/routes/_authenticated/batches.new.tsx` — mount `<BatchAssistCard onApply={...} />`, add `applyBatchSuggestion`, `pendingBatchSuggestion` state, `validateBatchSuggestion`, AlertDialog summary modal, soft-cap warning Alert.

---

### Phase 3 — Presets AI Assist (collapsed by default)

Lower priority — most preset fields are numeric knobs faster to slide than describe. Make it opt-in so it doesn't clutter the Create Preset dialog.

Mounted **inside the Create Preset `DialogContent`**, but wrapped in a `<Collapsible>` that defaults to closed, with a subtle trigger: *"Describe your preset with AI (optional)"*.

**Suggested fields**: `name`, `provider_name`, `model_name`, `system_prompt`, `default_prompt_text`, `temperature`, `top_p`, `max_tokens`, `evaluation_mode`, `notes`, `rationale`. Version fields left alone.

**Apply flow**: identical to Batches — direct apply when empty, summary modal with diff when any field is filled.

**Validation before Apply**: name 1–80, temperature 0–2, top_p 0–1, max_tokens 1–8192, evaluation_mode ∈ `ALLOWED_EVALUATION_MODES`, system_prompt ≤ 4000 chars. Inline destructive alert on failure.

**Files**:
- **New** `src/server/preset-assist.functions.ts` — `suggestPreset` server fn, same pattern. Tool schema = `propose_preset`.
- **New** `src/components/presets/PresetAssistCard.tsx` — same shape as the others, three preset-specific examples.
- **Edit** `src/routes/_authenticated/presets.tsx` — mount inside Collapsible at the top of Create Preset dialog, add apply/validate/diff modal logic.

---

### Consistent behaviour across all three pages

- **Suggest, don't apply** — preview card; nothing fills until you click Apply.
- **Single confirmation modal** with field-by-field diff if any target field has user input.
- **Client-side validation** blocks Apply on hard errors, warns on soft caps.
- **Footer** on every preview card identifies the model + endpoint.
- **Same error toasts** for missing key / 401 / 429 / 402.

### Out of scope (queued)

Custom user cases (`user_cases` table + JSON editor + solver wiring). When it lands, `allowed-values.ts` becomes the single integration point — every assistant picks up new cases automatically.

