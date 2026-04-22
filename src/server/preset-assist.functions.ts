import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";
import { ALLOWED_EVALUATION_MODES } from "@/lib/allowed-values";

const inputSchema = z.object({
  prompt: z.string().trim().min(3).max(2000),
});

export type PresetSuggestion = {
  name: string;
  provider_name: string;
  model_name: string;
  system_prompt: string;
  default_prompt_text: string;
  temperature: number;
  top_p: number;
  max_tokens: number;
  evaluation_mode: (typeof ALLOWED_EVALUATION_MODES)[number];
  notes: string;
  rationale: string;
};

export type SuggestPresetResult =
  | { ok: true; suggestion: PresetSuggestion; model: string }
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

const SYSTEM_PROMPT = `You are an LLM-config expert helping a user create an experiment PRESET for the GridArena benchmark.

A preset captures the LLM provider, model, sampling parameters, and prompts used by an experiment run.

You MUST call the propose_preset tool exactly once with:
- name: short, professional preset name (<= 80 chars)
- provider_name: e.g. "openai", "anthropic", "google"
- model_name: e.g. "gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet"
- system_prompt: a focused system message for a power-systems agent (<= 4000 chars)
- default_prompt_text: a user-message template the agent will receive
- temperature: 0..2, lower = more deterministic
- top_p: 0..1
- max_tokens: 1..8192
- evaluation_mode: one of "rule_based", "simulation", "auto"
- notes: 1-2 lines summarizing the preset's purpose
- rationale: why these parameters fit the user's described use case

Choose temperature/top_p that match the user's described behavior (careful baseline → low temp; creative explorer → higher temp).`;

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "propose_preset",
    description: "Return a fully-specified GridArena experiment preset.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 1, maxLength: 120 },
        provider_name: { type: "string", minLength: 1, maxLength: 60 },
        model_name: { type: "string", minLength: 1, maxLength: 80 },
        system_prompt: { type: "string", minLength: 1, maxLength: 4000 },
        default_prompt_text: { type: "string", minLength: 1, maxLength: 4000 },
        temperature: { type: "number", minimum: 0, maximum: 2 },
        top_p: { type: "number", minimum: 0, maximum: 1 },
        max_tokens: { type: "integer", minimum: 1, maximum: 8192 },
        evaluation_mode: { type: "string", enum: [...ALLOWED_EVALUATION_MODES] },
        notes: { type: "string", minLength: 1, maxLength: 400 },
        rationale: { type: "string", minLength: 5, maxLength: 400 },
      },
      required: [
        "name",
        "provider_name",
        "model_name",
        "system_prompt",
        "default_prompt_text",
        "temperature",
        "top_p",
        "max_tokens",
        "evaluation_mode",
        "notes",
        "rationale",
      ],
      additionalProperties: false,
    },
  },
};

const outputSchema = z.object({
  name: z.string().trim().min(1),
  provider_name: z.string().trim().min(1),
  model_name: z.string().trim().min(1),
  system_prompt: z.string().trim().min(1),
  default_prompt_text: z.string().trim().min(1),
  temperature: z.number().min(0).max(2),
  top_p: z.number().min(0).max(1),
  max_tokens: z.number().int().min(1).max(8192),
  evaluation_mode: z.enum(ALLOWED_EVALUATION_MODES),
  notes: z.string().trim().min(1),
  rationale: z.string().trim().min(1),
});

export const suggestPreset = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<SuggestPresetResult> => {
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
          tool_choice: { type: "function", function: { name: "propose_preset" } },
          temperature: 0.4,
          max_tokens: 1200,
        }),
      });
    } catch (e) {
      console.error("[suggestPreset] network error", e);
      return { ok: false, code: "network_error", error: "Could not reach the AI provider. Try again." };
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(`[suggestPreset] provider ${response.status}: ${text.slice(0, 500)}`);
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
      console.error("[suggestPreset] schema validation failed", validated.error.issues);
      return { ok: false, code: "invalid_output", error: "AI proposed an invalid preset. Try regenerating." };
    }

    return { ok: true, suggestion: validated.data, model };
  });
