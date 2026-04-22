

## Switch AI Assist from Lovable AI → your OpenAI key

You want the AI Assist features (scenario suggestions, batch suggestions, ask-AI panel, preset assist, the main agent in `src/server/llm.functions.ts`) to call **OpenAI directly with your own API key** instead of going through Lovable AI Gateway.

Good news: most of the code already uses `OPENAI_API_KEY` + `OPENAI_BASE_URL` (`https://api.openai.com/v1`) + `OPENAI_MODEL` env vars. The main work is auditing every call site, making sure none of them point at `ai.gateway.lovable.dev` or `LOVABLE_API_KEY`, and getting your key stored as a secret.

### Step 1 — Add your OpenAI key as a secret

I'll request the secret `OPENAI_API_KEY` so it's available in the server runtime. You'll paste your `sk-...` key into a secure dialog (never written to the repo).

Optional secrets I'll also wire up (with sensible defaults if you don't set them):
- `OPENAI_BASE_URL` — defaults to `https://api.openai.com/v1`
- `OPENAI_MODEL` — defaults to `gpt-4o-mini` (cheap + good for the assist features). Change to `gpt-4o`, `gpt-5`, etc. if you want.

### Step 2 — Audit every AI call site and force OpenAI

I'll grep the whole `src/server/` tree for `LOVABLE_API_KEY`, `ai.gateway.lovable.dev`, and any leftover provider-specific calls, then normalize all of them to the same pattern already used in `scenario-assist.functions.ts` and `batch-assist.functions.ts`:

```ts
const apiKey = process.env.OPENAI_API_KEY;
const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
fetch(`${baseUrl}/chat/completions`, { headers: { Authorization: `Bearer ${apiKey}` }, ... })
```

Files I'll inspect and update if needed:
- `src/server/llm.functions.ts` (the main agent — most important)
- `src/server/assistant.functions.ts` (Ask-AI panel)
- `src/server/preset-assist.functions.ts`
- `src/server/judge.functions.ts` (LLM-as-judge)
- `src/server/scenario-assist.functions.ts` (already correct — verify only)
- `src/server/batch-assist.functions.ts` (already correct — verify only)
- `src/server/health.functions.ts` (so the System Health page reports OpenAI status, not Lovable AI)

### Step 3 — Update health/status surfaces

- `HealthBadge` / `simulation-health` page: change the label from "Lovable AI" to "OpenAI" and probe `OPENAI_API_KEY` presence.
- Error messages already say "Set OPENAI_API_KEY on the server" — keep that copy consistent across all assist functions.

### Step 4 — Docs touch-up (optional, small)

- `src/routes/docs.installation.tsx` and `src/routes/docs.troubleshooting.tsx`: replace any mention of Lovable AI with a short note that GridArena uses your OpenAI key via the `OPENAI_API_KEY` secret. Skip if you'd rather leave docs alone.

### What stays the same

- Lovable Cloud (Supabase) for auth, DB, RLS — unchanged.
- All UI, schema, RLS, edge functions — unchanged.
- The structured-action / tool-calling contract — unchanged (OpenAI's `tools` API is what the code already uses).

### Cost & safety notes

- Your OpenAI key is billed to **your** OpenAI account, not Lovable. Set a usage cap in OpenAI's dashboard.
- Key is stored as a server-side secret — never sent to the browser, never logged.
- If you later want to switch back, just remove the `OPENAI_API_KEY` secret and re-enable Lovable AI; one env-var swap.

### Out of scope

- No model-routing UI (single global model via `OPENAI_MODEL`).
- No per-user BYOK (one key, server-wide).
- No streaming changes — current code is non-streaming JSON tool-calls, which works fine with OpenAI as-is.

