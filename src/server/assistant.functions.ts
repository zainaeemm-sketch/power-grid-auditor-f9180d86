import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";
import { GRIDARENA_KNOWLEDGE } from "@/lib/assistant-knowledge";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

const pageContextSchema = z
  .object({
    route: z.string().max(200).optional(),
    runId: z.string().max(100).optional(),
    batchId: z.string().max(100).optional(),
    hint: z.string().max(500).optional(),
  })
  .optional();

const askInputSchema = z.object({
  messages: z.array(messageSchema).min(1).max(30),
  pageContext: pageContextSchema,
  conversationId: z.string().uuid().optional(),
});

function buildSystemPrompt(pageContext?: z.infer<typeof pageContextSchema>) {
  const ctxLines: string[] = [];
  if (pageContext?.route) ctxLines.push(`- Current route: ${pageContext.route}`);
  if (pageContext?.runId) ctxLines.push(`- Selected run id: ${pageContext.runId}`);
  if (pageContext?.batchId) ctxLines.push(`- Selected batch id: ${pageContext.batchId}`);
  if (pageContext?.hint) ctxLines.push(`- UI hint: ${pageContext.hint}`);

  const ctxBlock = ctxLines.length
    ? `\n\nCURRENT PAGE CONTEXT (use to ground answers when relevant)\n${ctxLines.join("\n")}`
    : "";

  return `You are "Ask AI", the in-app support and research assistant for GridArena.

${GRIDARENA_KNOWLEDGE}${ctxBlock}

Format answers in concise Markdown. Use bullet lists and short headings when
helpful. When suggesting an action, name the exact page or panel
(e.g. "open Run Details → Parser Provenance"). If the user is on a run or
batch page (see context), assume "this run" / "this batch" refers to it.`;
}

export const askGridArenaAi = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: unknown) => askInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    if (!apiKey) {
      return {
        reply:
          "The assistant is not configured: missing `OPENAI_API_KEY`. An admin needs to set it in the project secrets.",
        error: "missing_api_key" as const,
        conversationId: data.conversationId ?? null,
      };
    }

    const { supabase, userId } = context;
    const lastUserMsg = [...data.messages].reverse().find((m) => m.role === "user");

    // Ensure conversation exists
    let conversationId = data.conversationId ?? null;
    if (!conversationId) {
      const title = (lastUserMsg?.content ?? "New conversation").slice(0, 60);
      const { data: conv, error: convErr } = await supabase
        .from("assistant_conversations")
        .insert({ user_id: userId, title })
        .select("id")
        .single();
      if (convErr || !conv) {
        console.error("[askGridArenaAi] failed to create conversation", convErr);
      } else {
        conversationId = conv.id;
      }
    }

    // Persist the user message
    if (conversationId && lastUserMsg) {
      await supabase.from("assistant_messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: lastUserMsg.content,
      });
    }

    const persistAssistant = async (content: string) => {
      if (!conversationId) return;
      await supabase.from("assistant_messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content,
      });
    };

    const systemPrompt = buildSystemPrompt(data.pageContext);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }, ...data.messages],
          temperature: 0.3,
          max_tokens: 800,
        }),
      });
    } catch (e) {
      console.error("[askGridArenaAi] network error", e);
      const reply = "I couldn't reach the AI provider. Please try again in a moment.";
      await persistAssistant(reply);
      return { reply, error: "network_error" as const, conversationId };
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(`[askGridArenaAi] provider error ${response.status}: ${text.slice(0, 500)}`);
      let reply = `The AI provider returned an error (${response.status}). Please try again.`;
      let error: "auth_error" | "rate_limited" | "quota_exhausted" | "provider_error" = "provider_error";
      if (response.status === 401) {
        reply = "The AI provider rejected the API key (401). An admin should verify `OPENAI_API_KEY`.";
        error = "auth_error";
      } else if (response.status === 429) {
        reply = "The AI provider is rate-limiting requests right now. Please try again in a few seconds.";
        error = "rate_limited";
      } else if (response.status === 402 || /quota|insufficient/i.test(text)) {
        reply = "The AI provider reports the account is out of credit/quota. An admin needs to top up.";
        error = "quota_exhausted";
      }
      await persistAssistant(reply);
      return { reply, error, conversationId };
    }

    const json = (await response.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: string } }> }
      | null;
    const reply = json?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      const fallback = "The AI provider returned an empty response. Please try rephrasing your question.";
      await persistAssistant(fallback);
      return { reply: fallback, error: "empty_response" as const, conversationId };
    }

    await persistAssistant(reply);
    return { reply, error: null, conversationId };
  });

export const listAssistantConversations = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("assistant_conversations")
      .select("id, title, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("[listAssistantConversations] error", error);
      return { conversations: [] as Array<{ id: string; title: string; updated_at: string }> };
    }
    return { conversations: data ?? [] };
  });

const idInput = z.object({ id: z.string().uuid() });

export const getAssistantConversation = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: unknown) => idInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: messages, error } = await supabase
      .from("assistant_messages")
      .select("role, content, created_at")
      .eq("conversation_id", data.id)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[getAssistantConversation] error", error);
      return { messages: [] as Array<{ role: "user" | "assistant"; content: string }> };
    }
    return {
      messages: (messages ?? []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    };
  });

export const deleteAssistantConversation = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: unknown) => idInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("assistant_conversations")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) {
      console.error("[deleteAssistantConversation] error", error);
      return { success: false };
    }
    return { success: true };
  });

const renameInput = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
});

export const renameAssistantConversation = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: unknown) => renameInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("assistant_conversations")
      .update({ title: data.title })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) {
      console.error("[renameAssistantConversation] error", error);
      return { success: false };
    }
    return { success: true };
  });
