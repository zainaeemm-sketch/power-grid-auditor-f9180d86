
## Persistent Ask AI Conversations

### Database (migration)
- **`assistant_conversations`**: `id`, `user_id`, `title` (text, auto from first user msg), `created_at`, `updated_at`. RLS: user-scoped CRUD.
- **`assistant_messages`**: `id`, `conversation_id` (FK cascade), `role` ('user'|'assistant'), `content` (text), `created_at`. RLS via parent conversation → user_id.
- Index on `(conversation_id, created_at)` and `(user_id, updated_at desc)`.
- Trigger to bump `assistant_conversations.updated_at` on new message.

### Server functions (`src/server/assistant.functions.ts`)
- `listAssistantConversations()` → `[{id, title, updated_at, message_count}]`, ordered by `updated_at desc`, limit 50.
- `getAssistantConversation({ id })` → `{conversation, messages[]}`.
- `deleteAssistantConversation({ id })` → cascade.
- `renameAssistantConversation({ id, title })`.
- Modify `askGridArenaAi` to accept optional `conversationId`. If absent, create a new conversation (title = first 60 chars of user msg). Persist user msg before LLM call, persist assistant reply after success. Return `{ reply, conversationId, error }`. On error, still persist user msg + error placeholder so history is consistent. (No persistence for `missing_api_key`.)

### Frontend
- **`AskAiPanel.tsx`**: 
  - Add left "history" rail inside the Sheet (collapsible, ~200px) listing conversations from a `useQuery`. Active convo highlighted. "+ New chat" button at top.
  - Track `conversationId` in state; pass it to `ask()` and store the returned id (for new chats).
  - Loading a past convo replaces in-memory `messages` with fetched ones.
  - Per-row hover: rename (inline) + delete (confirm) icons.
  - On send, invalidate the conversations list so titles/order update.
- Widen Sheet to ~640px (`sm:max-w-[640px]`) to fit sidebar + chat.

### Out of scope
- Full-text search across history · pinning · sharing · export.
