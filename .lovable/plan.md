
User wants their own OpenAI key (`OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` — all already set as Supabase secrets, confirmed in context). Swap the gateway target and keep everything else.

## Ask AI Assistant for GridArena (OpenAI direct)

### Backend

**`src/server/assistant.functions.ts`** — `askGridArenaAi` server fn
- `requireSupabaseAuth` middleware (signed-in users only)
- Zod input: `messages` (1–30, role + content ≤ 4000 chars), optional `pageContext` (route, runId, batchId, hint)
- Reads `process.env.OPENAI_API_KEY`, `process.env.OPENAI_MODEL` (fallback `gpt-4o-mini`), `process.env.OPENAI_BASE_URL` (fallback `https://api.openai.com/v1`)
- POSTs to `${BASE_URL}/chat/completions` with `Authorization: Bearer ${OPENAI_API_KEY}`
- Builds system prompt = GridArena identity + knowledge map + glossary + page-context block
- Non-streaming first pass (returns `{ reply: string }`); maps 401/429/quota errors to friendly messages
- No keys ever leave the server

**`src/lib/assistant-knowledge.ts`** — static GridArena KB used inside the system prompt: page map (Home, Runs, New Run, Run Details panels, Presets, Batches, Compare, Validation, Ground Truth, Sensitivity, Counterfactual Layer E, Decision Trace, Exports, Reproducibility), glossary (feasibility, grounding quality, parser provenance, optimality gap, decision regret, robustness score, action match, failure attribution), troubleshooting playbook.

### Frontend

**`src/components/assistant/AskAiButton.tsx`** — floating round Sparkles button (`fixed bottom-6 right-6 z-40`), primary accent, hidden on `/login` and `/pending-approval`, only shown when authenticated.

**`src/components/assistant/AskAiPanel.tsx`** — right-side `Sheet` (~420px, dark), header "Ask AI · GridArena assistant", message bubbles (user = primary, assistant = muted with `react-markdown`), context chip showing current page (e.g. "Context: Run abc123"), quick-prompt chips on empty state:
- Explain Runs · Explain Presets · Debug a failed run · Explain parser provenance · What does optimality gap mean? · How does counterfactual analysis work?

Input: textarea + send button, Enter sends / Shift+Enter newline, spinner while loading, toast on 429/quota errors. In-memory history per session (no DB).

**`src/hooks/usePageContext.ts`** — derives `{ route, runId, batchId, hint }` from `useLocation()` + `useParams({ strict: false })`.

**`src/routes/__root.tsx`** — mount `<AskAiButton />` once inside `AuthProvider`.

### Dependency
- Add `react-markdown` (used only in AskAiPanel).

### Out of scope (v1)
- Streaming responses · persistent chat history tables · RAG over live DB · auto-navigation from suggested actions.
