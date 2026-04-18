

The user wants to replace the deterministic `summarizeTrace` template in `src/lib/trace-explainer.ts` with an LLM-generated natural-language explanation, using an OpenAI API key they've provided before.

Let me check what secrets are configured.
<lov-tool-use id="toolu_vrtx_013sfvU2d6SomXSMC9UteWJg" name="secrets--fetch_secrets" integration-id="secrets" data="">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01GVsbFV2e5LgB91JRMhtsJq" name="tool_search" data="{\"target\": \"secrets--fetch_secrets\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01G4396L5bgCbkUtAbvbCBkb" name="secrets--fetch_secrets" integration-id="secrets" data="">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01BgzfQxeefAotcGutWsvDLZ" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/run-details/DecisionTracePanel.tsx\", \"lines\": \"1-50\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01RaM6N8GZnjb6yLnCbTngKj" name="code--view" integration-id="code" data="{\"file_path\": \"src/server/trace.functions.ts\"}">
</lov-tool-use>
I have enough context. The OpenAI key is already configured as a secret. I'll plan a server-side function that calls OpenAI to generate the explanation, with fallback to the deterministic template.

<lov-plan>
## Plan: AI-generated decision explanation

Replace the static template in `summarizeTrace` with an OpenAI-powered explanation, called from a new server function. Keep the deterministic template as a fallback.

### Approach
- The `OPENAI_API_KEY` (and optional `OPENAI_BASE_URL`, `OPENAI_MODEL`) are already configured as project secrets.
- Add a new server function `explainTrace` in `src/server/trace.functions.ts` that:
  - Takes `runId` (auth-gated; verifies the run belongs to the user via RLS).
  - Loads the run's traces (ordered) + evaluation summary.
  - Builds a compact, structured prompt: ordered list of stages (name, type, in/out, tool, status, ms) + evaluation deltas.
  - Calls OpenAI Chat Completions (`process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"`, model from `OPENAI_MODEL` else `gpt-5-mini`) with a system prompt asking for a 3–5 sentence plain-English explanation of the agent's decision flow.
  - Returns `{ explanation, source: "llm" | "fallback" }`. On any error (missing key, network, rate-limit), returns the deterministic `summarizeTrace(...)` text with `source: "fallback"`.
  - Wrapped in try/catch — never throws to the client.

### UI changes (`DecisionTracePanel.tsx`)
- After traces load, call `explainTrace` via `useServerFn`.
- Show a small skeleton/"Generating explanation…" while pending.
- Render the returned explanation in the existing "Decision Explanation" box.
- Add a small badge: "AI" when `source==="llm"`, "Template" when fallback.
- Add a "Regenerate" button (refetches the server fn).
- Keep `summarizeTrace` import as immediate fallback shown while the LLM call is in flight (so something always renders instantly).

### Files
**New / edited:**
- `src/server/trace.functions.ts` — add `explainTrace` server fn (uses `process.env.OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`).
- `src/components/run-details/DecisionTracePanel.tsx` — fetch + render LLM explanation, regenerate button, source badge.
- `src/lib/trace-explainer.ts` — keep `summarizeTrace` (used as instant + fallback). No removal, preserves backward compat.

### Safety / behavior
- Server-only key access (never exposed to client).
- Token-cap the prompt (truncate long input/output summaries to ~200 chars each, max ~30 stages).
- Deterministic fallback on any failure → existing UX never regresses.
- No schema changes, no new dependencies.
