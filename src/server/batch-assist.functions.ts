import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";
import { ALLOWED_AGENTS, ALLOWED_CASES } from "@/lib/allowed-values";

const inputSchema = z.object({
  prompt: z.string().trim().min(3).max(2000),
});

export type BatchSuggestion = {
  name: string;
  task: string;
  research_question: string;
  agents: string[];
  cases: string[];
  rationale: string;
};

export type SuggestBatchResult =
  | { ok: true; suggestion: BatchSuggestion; model: string }
  | {
      ok: false;
      error: string;
      code:
        | "missing_api_key"
        | "auth_error"
        | "rate_limited"
        | "quota_exhausted"
        | "provider_error"
        | "network_error"
        | "empty_response"
        | "invalid_output";
    };

const SYSTEM_PROMPT = `You are a power-systems research assistant helping a user design a BATCH experiment for the GridArena LLM-agent benchmark.

A batch sweeps a chosen set of agents across a chosen set of benchmark cases. Total runs = agents × cases.

You MUST call the propose_batch tool exactly once with:
- name: short, professional batch name (<= 80 chars)
- task: short identifier like "load_scaling", "n_minus_1", "redispatch", "generator_trip" (<= 60 chars, lowercase, snake_case preferred)
- research_question: one clear question the batch should answer
- agents: array of 1+ agent names. ONLY pick from the allowed list provided in the schema. Do NOT invent agent names.
- cases: array of 1+ case names. ONLY pick from the allowed list (case5, case14, case30).
- rationale: 1-2 sentences explaining the choice of agents and cases.

Keep the total agents × cases small unless the user explicitly asks for a sweep — typically 2-3 agents × 2-3 cases.`;

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "propose_batch",
    description: "Return a fully-specified GridArena batch experiment.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 1, maxLength: 120 },
        task: { type: "string", minLength: 1, maxLength: 80 },
        research_question: { type: "string", minLength: 5, maxLength: 400 },
        agents: {
          type: "array",
          minItems: 1,
          items: { type: "string", enum: [...ALLOWED_AGENTS] },
        },
        cases: {
          type: "array",
          minItems: 1,
          items: { type: "string", enum: [...ALLOWED_CASES] },
        },
        rationale: { type: "string", minLength: 5, maxLength: 400 },
      },
      required: ["name", "task", "research_question", "agents", "cases", "rationale"],
      additionalProperties: false,
    },
  },
};

const outputSchema = z.object({
  name: z.string().trim().min(1),
  task: z.string().trim().min(1),
  research_question: z.string().trim().min(1),
  agents: z.array(z.string().trim().min(1)).min(1),
  cases: z.array(z.string().trim().min(1)).min(1),
  rationale: z.string().trim().min(1),
});

export const suggestBatch = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<SuggestBatchResult> => {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    if (!apiKey) {
      return {
        ok: false,
        code: "missing_api_key",
        error: "Set OPENAI_API_KEY on the server to enable AI Assist. Check System Health for status.",
      };
    }

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
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: data.prompt },
          ],
          tools: [TOOL_SCHEMA],
          tool_choice: { type: "function", function: { name: "propose_batch" } },
          temperature: 0.4,
          max_tokens: 800,
        }),
      });
    } catch (e) {
      console.error("[suggestBatch] network error", e);
      return { ok: false, code: "network_error", error: "Could not reach the AI provider. Try again." };
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(`[suggestBatch] provider ${response.status}: ${text.slice(0, 500)}`);
      if (response.status === 401)
        return { ok: false, code: "auth_error", error: "OPENAI_API_KEY was rejected (401). Verify the key on the server." };
      if (response.status === 429)
        return { ok: false, code: "rate_limited", error: "Rate limited by the AI provider. Try again in a few seconds." };
      if (response.status === 402 || /quota|insufficient/i.test(text)) {
        return { ok: false, code: "quota_exhausted", error: "AI provider reports the account is out of credit/quota." };
      }
      return { ok: false, code: "provider_error", error: `AI provider returned ${response.status}.` };
    }

    const json = (await response.json().catch(() => null)) as
      | { choices?: Array<{ message?: { tool_calls?: Array<{ function?: { name?: string; arguments?: string } }> } }> }
      | null;

    const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
    const argsRaw = toolCall?.function?.arguments;
    if (!argsRaw) {
      return { ok: false, code: "empty_response", error: "AI did not return a structured suggestion. Try rephrasing." };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(argsRaw);
    } catch {
      return { ok: false, code: "invalid_output", error: "AI returned malformed output. Try regenerating." };
    }

    const validated = outputSchema.safeParse(parsed);
    if (!validated.success) {
      console.error("[suggestBatch] schema validation failed", validated.error.issues);
      return { ok: false, code: "invalid_output", error: "AI proposed an invalid batch. Try regenerating." };
    }

    return { ok: true, suggestion: validated.data, model };
  });
