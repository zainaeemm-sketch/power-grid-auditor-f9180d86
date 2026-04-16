

# Phase 4: Secure LLM Execution & Parser Integration

## Overview

Add a server-side `executeRunLlm` function that orchestrates the full LLM pipeline (prompt → call → save response → save recommendation → parse → save parse result), and wire it to a "Run LLM Automatically" button on the Prompt Log panel.

## Architecture Decision: LLM Provider

The user's spec requires configurable provider URLs and model names from run metadata, with fallback to environment secrets (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`). This is appropriate for a research platform where users experiment with different providers.

Three secrets need to be added: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`.

## Implementation

### Step 1: Add Secrets

Use `add_secret` to request `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL` from the user.

### Step 2: Server Function — `executeRunLlm`

Add to `src/server/runs.functions.ts`:

```
executeRunLlm(run_id: string) → { success, response_text, recommendation_text, parseResult, error? }
```

Pipeline:
1. Load run, run_metadata, run_prompt_logs
2. Determine prompt (from prompt_logs, or generate fallback from run.task/case_name/research_question)
3. Determine provider settings (metadata first, then env fallbacks)
4. Call LLM via `fetch()` to `{base_url}/chat/completions` with Bearer token — all server-side via `process.env`
5. Extract response_text from OpenAI-compatible response
6. Upsert `run_prompt_logs.response_text`
7. Upsert `run_recommendations.recommendation_text` (same text)
8. Run parser, upsert `run_parse_results`
9. Update run status to `completed`
10. Return all updated data

Error handling: wrap in try/catch, return `{ success: false, error: "..." }`. 60s timeout via AbortController.

### Step 3: Parser Function

Add `parseRecommendationText(text: string)` as a pure helper in `src/server/runs.functions.ts`:

- Regex match "scale all loads" → `scale_all_loads`, extract numeric value
- Regex match "set generator" → `set_generator_p_mw`, extract generator index + MW value
- Regex match "line outage" / "take line" → `line_outage`, extract line number
- Default → `action_type: "none"`

Returns `{ source_text, parser_notes, action_type, target_index, value, enabled }`.

### Step 4: UI — Run LLM Button

Update `RunPromptLogPanel.tsx`:
- Add "Run LLM Automatically" button (emerald accent)
- `useState` for `executing` flag
- On click: call `executeRunLlm` via `useServerFn`, show loading spinner
- On success: update local state for promptText/responseText, toast success, trigger page data refresh via `router.invalidate()`
- On error: toast error message
- Callback prop `onExecutionComplete` to let parent know data changed

### Step 5: Wire Refresh in Route

Update `runs.$runId.tsx`: pass an `onExecutionComplete` callback or rely on `router.invalidate()` to re-run the loader and refresh all panels (recommendation, parser provenance, structured action, timeline).

## Files Changed

| File | Action |
|------|--------|
| `src/server/runs.functions.ts` | Add `executeRunLlm` + `parseRecommendationText` |
| `src/components/run-details/RunPromptLogPanel.tsx` | Add Run LLM button with loading/error states |
| `src/routes/_authenticated/runs.$runId.tsx` | Minor: no structural changes needed (router.invalidate handles refresh) |

## Security

- API key accessed only via `process.env.OPENAI_API_KEY` inside server function
- Never logged, never returned to client, never stored in DB
- Provider URL and model name from metadata are not secrets (user-configured)

