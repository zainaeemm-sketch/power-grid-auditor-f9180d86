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

const inputSchema = z.object({
  messages: z.array(messageSchema).min(1).max(30),
  pageContext: pageContextSchema,
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
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    if (!apiKey) {
      return {
        reply:
          "The assistant is not configured: missing `OPENAI_API_KEY`. An admin needs to set it in the project secrets.",
        error: "missing_api_key" as const,
      };
    }

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
      return {
        reply: "I couldn't reach the AI provider. Please try again in a moment.",
        error: "network_error" as const,
      };
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(`[askGridArenaAi] provider error ${response.status}: ${text.slice(0, 500)}`);
      if (response.status === 401) {
        return {
          reply: "The AI provider rejected the API key (401). An admin should verify `OPENAI_API_KEY`.",
          error: "auth_error" as const,
        };
      }
      if (response.status === 429) {
        return {
          reply: "The AI provider is rate-limiting requests right now. Please try again in a few seconds.",
          error: "rate_limited" as const,
        };
      }
      if (response.status === 402 || /quota|insufficient/i.test(text)) {
        return {
          reply: "The AI provider reports the account is out of credit/quota. An admin needs to top up.",
          error: "quota_exhausted" as const,
        };
      }
      return {
        reply: `The AI provider returned an error (${response.status}). Please try again.`,
        error: "provider_error" as const,
      };
    }

    const json = (await response.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: string } }> }
      | null;
    const reply = json?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return {
        reply: "The AI provider returned an empty response. Please try rephrasing your question.",
        error: "empty_response" as const,
      };
    }

    return { reply, error: null };
  });
