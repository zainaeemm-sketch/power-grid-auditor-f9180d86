import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";
import { withRetry, isTransientHttpStatus } from "@/lib/server-utils";
import { TraceRecorder } from "./trace/recorder";

/**
 * Persist a human-readable failure message to run_metadata.notes (appended)
 * and revert the run status back to "queued" so it can be retried.
 * The DB enum has no "failed" value, so we use the notes field as the source of truth.
 */
async function recordRunFailure(supabase: any, runId: string, message: string) {
  try {
    const { data: meta } = await supabase
      .from("run_metadata").select("notes").eq("run_id", runId).maybeSingle();
    const stamp = new Date().toISOString();
    const line = `[${stamp}] FAILED: ${message}`;
    const newNotes = meta?.notes ? `${meta.notes}\n${line}` : line;
    if (meta) {
      await supabase.from("run_metadata").update({ notes: newNotes }).eq("run_id", runId);
    } else {
      await supabase.from("run_metadata").insert({ run_id: runId, notes: newNotes });
    }
    await supabase.from("runs").update({ status: "queued" as const }).eq("id", runId);
  } catch (err) {
    console.error("Failed to record run failure:", err);
  }
}

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
    const tracer = new TraceRecorder();
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

    tracer.record({
      stage_name: "Prompt received",
      stage_type: "reasoning",
      input: `Case: ${run.case_name}, Task: ${run.task}`,
      output: promptText,
      execution_time_ms: 0,
      evidence: { case_name: run.case_name, task: run.task, research_question: run.research_question ?? null },
    });
    const systemPrompt = metadata?.system_prompt
      || "You are a power systems assistant. Provide concise, actionable recommendations.";

    const baseUrl = metadata?.provider_base_url || process.env.OPENAI_BASE_URL;
    const modelName = metadata?.model_name || process.env.OPENAI_MODEL || "gpt-4o-mini";
    const apiKey = process.env.OPENAI_API_KEY;
    const temperature = typeof metadata?.temperature === "number" ? metadata.temperature : 0.2;
    const maxTokens = typeof metadata?.max_tokens === "number" ? metadata.max_tokens : undefined;
    const topP = typeof metadata?.top_p === "number" ? metadata.top_p : undefined;
    const seed = typeof metadata?.random_seed === "number" ? metadata.random_seed : undefined;

    if (!baseUrl) {
      const msg = "No provider base URL configured. Set it in run metadata or OPENAI_BASE_URL secret.";
      await recordRunFailure(supabase, runId, msg);
      return { success: false, error: msg, retryable: false };
    }
    if (!apiKey) {
      const msg = "API key not configured. Set the OPENAI_API_KEY secret.";
      await recordRunFailure(supabase, runId, msg);
      return { success: false, error: msg, retryable: false };
    }

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

    try {
      // Retry on transient (5xx / network) failures only — never on 4xx (config/auth).
      responseText = await withRetry(async () => {
        const llmRes = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!llmRes.ok) {
          const errText = await llmRes.text().catch(() => "");
          const err = new Error(`Provider request failed (${llmRes.status}): ${errText.slice(0, 200)}`);
          (err as any).status = llmRes.status;
          throw err;
        }

        const llmJson = await llmRes.json();
        const text = llmJson.choices?.[0]?.message?.content ?? "";
        if (!text) throw new Error("LLM returned empty response");
        return text as string;
      }, {
        maxAttempts: 2,
        delayMs: 1000,
        shouldRetry: (err: any) => {
          if (err?.name === "AbortError") return false;
          if (typeof err?.status === "number") return isTransientHttpStatus(err.status);
          return true; // network error
        },
      });
      clearTimeout(timeout);
    } catch (err: any) {
      clearTimeout(timeout);
      const isTimeout = err?.name === "AbortError";
      const status: number | undefined = err?.status;
      const retryable = isTimeout || (typeof status === "number" ? isTransientHttpStatus(status) : true);
      const message = isTimeout
        ? "LLM execution timed out (60s)"
        : err?.message ?? "Unknown LLM failure";
      await recordRunFailure(supabase, runId, message);
      return { success: false, error: message, retryable };
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
      const evalFields: any = computeEvaluation(fullParseResult as any, actionResult);

      // Ground-truth comparison (optional — only when run has ground_truth_scenario_id)
      const gtScenarioId = (run as any).ground_truth_scenario_id as string | null | undefined;
      if (gtScenarioId) {
        try {
          const { compareToGroundTruth } = await import("./ground-truth/compare");
          const { data: refActions } = await (supabase as any)
            .from("ground_truth_actions")
            .select("*")
            .eq("scenario_id", gtScenarioId);
          if (refActions && refActions.length > 0) {
            const cmp = compareToGroundTruth(
              { action_type: parseResult.action_type ?? null, target_index: parseResult.target_index ?? null, value: parseResult.value ?? null },
              { feasibility: evalFields.feasibility, violation_improvement: evalFields.violation_improvement },
              refActions,
            );
            evalFields.action_match = cmp.action_match;
            evalFields.feasibility_match = cmp.feasibility_match;
            evalFields.optimality_gap = cmp.optimality_gap;
            evalFields.deviation_from_reference = Number.isFinite(cmp.deviation_from_reference) ? cmp.deviation_from_reference : null;
            evalFields.evaluation_against_ground_truth = true;
          }
        } catch (gtErr: any) {
          console.error("Ground-truth comparison failed:", gtErr?.message);
        }
      }

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
