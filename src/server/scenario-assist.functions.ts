import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";
import { ALLOWED_CASES, ALLOWED_EVALUATION_MODES as ALLOWED_MODES } from "@/lib/allowed-values";

const inputSchema = z.object({
  prompt: z.string().trim().min(3).max(2000),
});

export type ScenarioSuggestion = {
  title: string;
  task: string;
  case_name: (typeof ALLOWED_CASES)[number];
  evaluation_mode: (typeof ALLOWED_MODES)[number];
  research_question: string;
  rationale: string;
};

export type SuggestScenarioResult =
  | { ok: true; suggestion: ScenarioSuggestion; model: string }
  | { ok: false; error: string; code: "missing_api_key" | "auth_error" | "rate_limited" | "quota_exhausted" | "provider_error" | "network_error" | "empty_response" | "invalid_output" };

const SYSTEM_PROMPT = `You are a power-systems research assistant helping a user design a single experiment scenario for the GridArena LLM-agent benchmark.

You MUST call the propose_scenario tool exactly once with a fully-specified scenario. Constraints:

- case_name MUST be one of: "case5" (5-bus IEEE), "case14" (14-bus IEEE), or "case30" (30-bus IEEE). No other cases exist in this build.
- The task should describe a SINGLE corrective action the agent must propose. Available action types:
  * set_generator_p_mw (target a generator index, set MW value)
  * scale_all_loads (multiplier in 0.85-1.15)
  * line_outage (open a branch index)
- Tasks should describe a stressed condition (overload, N-1 contingency, generator trip, load spike) so baseline violations are non-zero.
- evaluation_mode: prefer "simulation" for scenarios that need power-flow checks; "rule_based" only for trivial heuristics; "auto" if unsure.
- title: short (<= 80 chars), professional.
- research_question: one clear question the run should answer.
- rationale: 1-2 sentences explaining why this case + contingency was chosen.`;

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "propose_scenario",
    description: "Return a fully-specified GridArena experiment scenario.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 3, maxLength: 120 },
        task: { type: "string", minLength: 20, maxLength: 1500 },
        case_name: { type: "string", enum: [...ALLOWED_CASES] },
        evaluation_mode: { type: "string", enum: [...ALLOWED_MODES] },
        research_question: { type: "string", minLength: 5, maxLength: 400 },
        rationale: { type: "string", minLength: 5, maxLength: 400 },
      },
      required: ["title", "task", "case_name", "evaluation_mode", "research_question", "rationale"],
      additionalProperties: false,
    },
  },
};

const outputSchema = z.object({
  title: z.string().trim().min(1),
  task: z.string().trim().min(1),
  case_name: z.enum(ALLOWED_CASES),
  evaluation_mode: z.enum(ALLOWED_MODES),
  research_question: z.string().trim().min(1),
  rationale: z.string().trim().min(1),
});

export const suggestScenario = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<SuggestScenarioResult> => {
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
          tool_choice: { type: "function", function: { name: "propose_scenario" } },
          temperature: 0.4,
          max_tokens: 800,
        }),
      });
    } catch (e) {
      console.error("[suggestScenario] network error", e);
      return { ok: false, code: "network_error", error: "Could not reach the AI provider. Try again." };
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(`[suggestScenario] provider ${response.status}: ${text.slice(0, 500)}`);
      if (response.status === 401) return { ok: false, code: "auth_error", error: "OPENAI_API_KEY was rejected (401). Verify the key on the server." };
      if (response.status === 429) return { ok: false, code: "rate_limited", error: "Rate limited by the AI provider. Try again in a few seconds." };
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
      console.error("[suggestScenario] schema validation failed", validated.error.issues);
      return { ok: false, code: "invalid_output", error: "AI proposed an invalid scenario. Try regenerating." };
    }

    return { ok: true, suggestion: validated.data, model };
  });
