import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";

const PARSER_VERSION = "v1";
const EVALUATION_LOGIC_VERSION = "v1";

interface ParseResult {
  source_text: string;
  parser_notes: string;
  action_type: string;
  target_index: number | null;
  value: number | null;
  enabled: boolean;
}

export function parseRecommendationText(text: string): ParseResult {
  const lower = text.toLowerCase();

  const reduceMatch = lower.match(/reduce\s+(?:all\s+)?loads?\s*(?:by)?\s*([\d.]+)\s*%/);
  if (reduceMatch) {
    const pct = parseFloat(reduceMatch[1]);
    const factor = +(1 - pct / 100).toFixed(4);
    const phrase = reduceMatch[0];
    return {
      source_text: text,
      parser_notes: `Matched load reduction rule from phrase '${phrase}' and extracted factor ${factor} (100% - ${pct}% = ${factor}).`,
      action_type: "scale_all_loads",
      target_index: null,
      value: factor,
      enabled: true,
    };
  }

  const scaleMatch = lower.match(/scale\s+all\s+loads?\s*(?:by|to|with|factor)?\s*([\d.]+)/);
  if (scaleMatch) {
    const factor = parseFloat(scaleMatch[1]);
    const phrase = scaleMatch[0];
    return {
      source_text: text,
      parser_notes: `Matched load scaling rule from phrase '${phrase}' and extracted factor ${factor}.`,
      action_type: "scale_all_loads",
      target_index: null,
      value: factor,
      enabled: true,
    };
  }

  const genMatch = lower.match(/set\s+generator\s*(\d+)\s*(?:to|at|=)?\s*([\d.]+)\s*(?:mw)?/);
  if (genMatch) {
    const genIdx = parseInt(genMatch[1], 10);
    const mw = parseFloat(genMatch[2]);
    return {
      source_text: text,
      parser_notes: `Matched generator dispatch rule and extracted generator ${genIdx} with target ${mw} MW.`,
      action_type: "set_generator_p_mw",
      target_index: genIdx,
      value: mw,
      enabled: true,
    };
  }

  const lineMatch = lower.match(/(?:line\s+outage|take\s+line)\s*(\d+)/);
  if (lineMatch) {
    const lineIdx = parseInt(lineMatch[1], 10);
    const phrase = lineMatch[0];
    return {
      source_text: text,
      parser_notes: `Matched line outage rule for line ${lineIdx} from phrase '${phrase}'.`,
      action_type: "line_outage",
      target_index: lineIdx,
      value: null,
      enabled: true,
    };
  }

  return {
    source_text: text,
    parser_notes: "No supported control action pattern found in recommendation text, defaulted to action_type='none'.",
    action_type: "none",
    target_index: null,
    value: null,
    enabled: false,
  };
}

export const executeRunLlm = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { run_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const runId = data.run_id;

    const { data: run, error: runErr } = await supabase
      .from("runs").select("*").eq("id", runId).single();
    if (runErr || !run) return { success: false, error: "Run not found" };

    const [metaRes, promptRes] = await Promise.all([
      supabase.from("run_metadata").select("*").eq("run_id", runId).maybeSingle(),
      supabase.from("run_prompt_logs").select("*").eq("run_id", runId).maybeSingle(),
    ]);

    const metadata = metaRes.data as any;
    const promptLog = promptRes.data;

    // Determine prompt
    let promptText = promptLog?.prompt_text;
    if (!promptText) {
      promptText = `You are analyzing the ${run.case_name} power system case. Task: ${run.task}. ${run.research_question ? `Research question: ${run.research_question}.` : ""} Recommend one concise action to address the task.`;
    }

    const systemPrompt = metadata?.system_prompt
      || "You are a power systems assistant. Provide concise, actionable recommendations.";

    const baseUrl = metadata?.provider_base_url || process.env.OPENAI_BASE_URL;
    const modelName = metadata?.model_name || process.env.OPENAI_MODEL || "gpt-4o-mini";
    const apiKey = process.env.OPENAI_API_KEY;
    const temperature = typeof metadata?.temperature === "number" ? metadata.temperature : 0.2;
    const maxTokens = typeof metadata?.max_tokens === "number" ? metadata.max_tokens : undefined;
    const topP = typeof metadata?.top_p === "number" ? metadata.top_p : undefined;
    const seed = typeof metadata?.random_seed === "number" ? metadata.random_seed : undefined;

    if (!baseUrl) return { success: false, error: "No provider base URL configured. Set it in run metadata or OPENAI_BASE_URL secret." };
    if (!apiKey) return { success: false, error: "API key not configured. Set the OPENAI_API_KEY secret." };

    // Stamp execution timestamp + version constants on metadata BEFORE the call
    const stampFields: Record<string, unknown> = {
      execution_timestamp: new Date().toISOString(),
      parser_version: metadata?.parser_version || PARSER_VERSION,
      evaluation_logic_version: metadata?.evaluation_logic_version || EVALUATION_LOGIC_VERSION,
    };
    if (metadata) {
      await (supabase as any).from("run_metadata").update(stampFields).eq("run_id", runId);
    } else {
      await (supabase as any).from("run_metadata").insert({ run_id: runId, ...stampFields });
    }

    // Mark running
    await supabase.from("runs").update({ status: "running" as const }).eq("id", runId);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    let responseText: string;
    try {
      const body: any = {
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: promptText },
        ],
        temperature,
      };
      if (maxTokens) body.max_tokens = maxTokens;
      if (typeof topP === "number") body.top_p = topP;
      if (typeof seed === "number") body.seed = seed;

      const llmRes = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!llmRes.ok) {
        const errText = await llmRes.text().catch(() => "");
        return { success: false, error: `Provider request failed (${llmRes.status}): ${errText.slice(0, 200)}` };
      }

      const llmJson = await llmRes.json();
      responseText = llmJson.choices?.[0]?.message?.content ?? "";
      if (!responseText) return { success: false, error: "LLM returned empty response" };
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError") return { success: false, error: "LLM execution timed out (60s)" };
      return { success: false, error: `Network error: ${err.message}` };
    }

    if (promptLog) {
      await supabase.from("run_prompt_logs").update({ response_text: responseText }).eq("run_id", runId);
    } else {
      await supabase.from("run_prompt_logs").insert({ run_id: runId, prompt_text: promptText, response_text: responseText });
    }

    const { data: existingRec } = await (supabase as any)
      .from("run_recommendations").select("id").eq("run_id", runId).maybeSingle();

    if (existingRec) {
      await (supabase as any).from("run_recommendations").update({ recommendation_text: responseText }).eq("run_id", runId);
    } else {
      await (supabase as any).from("run_recommendations").insert({ run_id: runId, recommendation_text: responseText });
    }

    const parseResult = parseRecommendationText(responseText);
    const { data: existingParse } = await (supabase as any)
      .from("run_parse_results").select("id").eq("run_id", runId).maybeSingle();

    if (existingParse) {
      await (supabase as any).from("run_parse_results").update(parseResult).eq("run_id", runId);
    } else {
      await (supabase as any).from("run_parse_results").insert({ run_id: runId, ...parseResult });
    }

    const actionFields = {
      action_type: parseResult.action_type,
      target_index: parseResult.target_index,
      value: parseResult.value,
      enabled: parseResult.enabled,
    };
    const { data: existingAction } = await (supabase as any)
      .from("run_actions").select("id").eq("run_id", runId).maybeSingle();

    if (existingAction) {
      await (supabase as any).from("run_actions").update(actionFields).eq("run_id", runId);
    } else {
      await (supabase as any).from("run_actions").insert({ run_id: runId, ...actionFields });
    }

    let evaluationResult = null;
    try {
      const { applyParsedAction, computeEvaluation } = await import("./evaluation.functions");
      const fullParseResult = { ...parseResult, id: "", run_id: runId, created_at: "", updated_at: "" };
      const actionResult = applyParsedAction(fullParseResult as any);
      const evalFields = computeEvaluation(fullParseResult as any, actionResult);

      const { data: existingEval } = await (supabase as any)
        .from("run_evaluations").select("id").eq("run_id", runId).maybeSingle();

      if (existingEval) {
        const { data } = await (supabase as any).from("run_evaluations").update(evalFields).eq("run_id", runId).select("*").single();
        evaluationResult = data;
      } else {
        const { data } = await (supabase as any).from("run_evaluations").insert({ run_id: runId, ...evalFields }).select("*").single();
        evaluationResult = data;
      }
    } catch (evalErr: any) {
      console.error("Evaluation failed:", evalErr.message);
    }

    await supabase.from("runs").update({ status: "completed" as const }).eq("id", runId);

    return {
      success: true,
      response_text: responseText,
      recommendation_text: responseText,
      parseResult,
      evaluation: evaluationResult,
    };
  });
