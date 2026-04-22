

## Use the user's OpenAI key (not Lovable AI) for the Scenario Assist suggestion card

You're right — the previous plan said "Lovable AI". This project already has its own LLM setup (`OPENAI_API_KEY` + `OPENAI_BASE_URL` + `OPENAI_MODEL`, the same vars shown on the System Health page), and existing server functions in `src/server/assistant.functions.ts` and `src/server/llm.functions.ts` already call that OpenAI-compatible endpoint. The Scenario Assist feature will reuse that exact same path — no Lovable AI gateway, no new keys.

### What changes vs the previous plan

- The new server function `suggestScenario` will call **the same OpenAI-compatible endpoint** the rest of the app already uses (`OPENAI_BASE_URL` + `OPENAI_API_KEY`, model = `OPENAI_MODEL`), via the existing helper pattern in `src/server/llm.functions.ts` / `assistant.functions.ts`.
- No reference to Lovable AI, no `LOVABLE_API_KEY`, no `ai.gateway.lovable.dev`.
- The suggestion card UI will show a small footer line: **"Suggested by `{OPENAI_MODEL}` via your configured OpenAI endpoint"** so it's visually obvious which key/model produced it.
- If `OPENAI_API_KEY` is missing on the server, the function returns a clear error and the UI shows: *"Set OPENAI_API_KEY on the server to enable AI Assist"* (links mentally to the System Health page where you already see this status).

### Files (unchanged from before, just corrected provider)

- **New** `src/server/scenario-assist.functions.ts` — `suggestScenario` server fn. Auth-protected via `requireSupabaseAuth`. Reads `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` from `process.env`. Uses tool-calling (`propose_scenario` function schema) for structured output. Constrains `case_name` to `case5` | `case14` | `case30`. Surfaces 401/402/429 from the upstream OpenAI-compatible provider as typed error messages.
- **New** `src/components/new-run/ScenarioAssistCard.tsx` — textarea + "Suggest with AI" button + preview card with **Apply to form** / **Discard** / **Regenerate**. Footer shows the model name returned by the server.
- **Edit** `src/routes/_authenticated/new-run.tsx` — mount `<ScenarioAssistCard onApply={...} />` above the Stressed quick-pick. `applySuggestion` does per-field overwrite confirmation.

### Behaviour (unchanged)

- Suggest, don't apply: form fields stay untouched until you click **Apply to form**.
- Per-field overwrite confirmation if a field already has user input.
- AI is constrained to the 3 supported cases so the simulator can actually run the result.

### Out of scope (saved for the follow-up)

Custom user cases (`user_cases` table + JSON case editor + solver wiring) — separate plan after this ships.

