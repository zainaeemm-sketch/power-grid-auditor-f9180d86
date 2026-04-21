import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";

export interface RunLlmJudgment {
  id: string;
  run_id: string;
  verdict: "agree" | "partial" | "disagree" | null;
  confidence: "high" | "medium" | "low" | null;
  reasoning_quality: "sound" | "flawed" | "unsupported" | null;
  action_alignment: "aligned" | "partial" | "misaligned" | null;
  critique: string | null;
  disagreement_reason: string | null;
  model: string | null;
  provider: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

const JUDGE_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_judgment",
    description:
      "Submit an independent power-systems reviewer judgment of an agent's recommendation vs the simulator's verdict.",
    parameters: {
      type: "object",
      properties: {
        verdict: { type: "string", enum: ["agree", "partial", "disagree"] },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        reasoning_quality: { type: "string", enum: ["sound", "flawed", "unsupported"] },
        action_alignment: { type: "string", enum: ["aligned", "partial", "misaligned"] },
        critique: { type: "string", maxLength: 300 },
        disagreement_reason: { type: "string" },
      },
      required: ["verdict", "confidence", "reasoning_quality", "action_alignment", "critique"],
      additionalProperties: false,
    },
  },
};

async function resolveOpenAiConfig(supabase: any, userId: string, runMetadata: any) {
  const { data: pref } = await supabase
    .from("user_preferences")
    .select("openai_model")
    .eq("user_id", userId)
    .maybeSingle();
  const baseUrl = (runMetadata?.provider_base_url || process.env.OPENAI_BASE_URL || "").replace(/\/+$/, "");
  const apiKey = process.env.OPENAI_API_KEY;
  const model =
    (pref as any)?.openai_model ||
    runMetadata?.model_name ||
    process.env.OPENAI_MODEL ||
    "gpt-4o-mini";
  return { baseUrl, apiKey, model };
}

function buildJudgeMessages(payload: {
  case_name: string;
  task: string;
  research_question: string | null;
  recommendation: string;
  parsed_action: { action_type: string | null; target_index: number | null; value: number | null };
  evaluation: {
    feasibility: string;
    violations_found: number;
    violation_improvement: number;
    engine_used: string | null;
    notes: string | null;
  };
  ground_truth?: {
    actions: Array<{ action_type: string; target_index: number | null; value: number | null }>;
  } | null;
}) {
  const system =
    "You are an independent power-systems reviewer. Judge whether an AI agent's recommendation is appropriate given the simulator's verdict. " +
    "Be concise (critique ≤300 chars). Submit your judgment only via the submit_judgment tool — no free text.";

  const summary = [
    `Case: ${payload.case_name}`,
    `Task: ${payload.task}`,
    payload.research_question ? `Research question: ${payload.research_question}` : null,
    "",
    "AGENT RECOMMENDATION:",
    payload.recommendation || "(empty)",
    "",
    "PARSED ACTION:",
    JSON.stringify(payload.parsed_action),
    "",
    "SIMULATOR VERDICT:",
    `feasibility=${payload.evaluation.feasibility}, violations=${payload.evaluation.violations_found}, improvement=${payload.evaluation.violation_improvement}, engine=${payload.evaluation.engine_used ?? "n/a"}`,
    payload.evaluation.notes ? `notes: ${payload.evaluation.notes}` : null,
    payload.ground_truth?.actions?.length
      ? `\nGROUND TRUTH (${payload.ground_truth.actions.length} ref action(s)):\n${JSON.stringify(payload.ground_truth.actions)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: summary },
  ];
}

async function persistJudgment(
  supabase: any,
  runId: string,
  fields: Partial<RunLlmJudgment>,
): Promise<RunLlmJudgment | null> {
  const row = { run_id: runId, ...fields, updated_at: new Date().toISOString() };
  const { data: existing } = await supabase
    .from("run_llm_judgments")
    .select("id")
    .eq("run_id", runId)
    .maybeSingle();
  if (existing) {
    const { data } = await supabase
      .from("run_llm_judgments")
      .update(row)
      .eq("run_id", runId)
      .select("*")
      .single();
    return data as RunLlmJudgment;
  }
  const { data } = await supabase
    .from("run_llm_judgments")
    .insert(row)
    .select("*")
    .single();
  return data as RunLlmJudgment;
}

export const judgeRun = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { runId: string }) => input)
  .handler(async ({ data, context }): Promise<{ judgment: RunLlmJudgment | null; error?: string }> => {
    const { supabase, userId } = context;
    const runId = data.runId;

    const { data: run } = await (supabase as any).from("runs").select("*").eq("id", runId).single();
    if (!run) return { judgment: null, error: "Run not found" };

    const [recRes, parseRes, evalRes, metaRes] = await Promise.all([
      (supabase as any).from("run_recommendations").select("*").eq("run_id", runId).maybeSingle(),
      (supabase as any).from("run_parse_results").select("*").eq("run_id", runId).maybeSingle(),
      (supabase as any).from("run_evaluations").select("*").eq("run_id", runId).maybeSingle(),
      (supabase as any).from("run_metadata").select("*").eq("run_id", runId).maybeSingle(),
    ]);

    const evaluation = evalRes.data;
    if (!evaluation) {
      const j = await persistJudgment(supabase, runId, {
        error: "No evaluation yet — cannot judge.",
        model: null,
        provider: null,
      });
      return { judgment: j, error: "No evaluation yet" };
    }

    let groundTruth: any = null;
    if ((run as any).ground_truth_scenario_id) {
      const { data: gtActs } = await (supabase as any)
        .from("ground_truth_actions")
        .select("action_type,target_index,value")
        .eq("scenario_id", (run as any).ground_truth_scenario_id);
      if (gtActs?.length) groundTruth = { actions: gtActs };
    }

    const { baseUrl, apiKey, model } = await resolveOpenAiConfig(supabase, userId, metaRes.data);

    if (!baseUrl || !apiKey) {
      const j = await persistJudgment(supabase, runId, {
        error: "OpenAI not configured (OPENAI_BASE_URL or OPENAI_API_KEY missing).",
        model,
        provider: "openai",
      });
      return { judgment: j, error: "OpenAI not configured" };
    }

    const messages = buildJudgeMessages({
      case_name: run.case_name,
      task: run.task,
      research_question: run.research_question ?? null,
      recommendation: recRes.data?.recommendation_text ?? "",
      parsed_action: {
        action_type: parseRes.data?.action_type ?? null,
        target_index: parseRes.data?.target_index ?? null,
        value: parseRes.data?.value ?? null,
      },
      evaluation: {
        feasibility: evaluation.feasibility,
        violations_found: evaluation.violations_found,
        violation_improvement: Number(evaluation.violation_improvement),
        engine_used: evaluation.engine_used ?? null,
        notes: evaluation.notes ?? null,
      },
      ground_truth: groundTruth,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.1,
          tools: [JUDGE_TOOL],
          tool_choice: { type: "function", function: { name: "submit_judgment" } },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        const msg = `Judge request failed (${res.status}): ${errText.slice(0, 200)}`;
        const j = await persistJudgment(supabase, runId, { error: msg, model, provider: "openai" });
        return { judgment: j, error: msg };
      }

      const json = await res.json();
      const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
      const argsStr = toolCall?.function?.arguments;
      if (!argsStr) {
        const msg = "Judge returned no tool call";
        const j = await persistJudgment(supabase, runId, { error: msg, model, provider: "openai" });
        return { judgment: j, error: msg };
      }

      let parsed: any;
      try {
        parsed = JSON.parse(argsStr);
      } catch (e: any) {
        const msg = `Failed to parse judge output: ${e?.message ?? "invalid JSON"}`;
        const j = await persistJudgment(supabase, runId, { error: msg, model, provider: "openai" });
        return { judgment: j, error: msg };
      }

      const judgment = await persistJudgment(supabase, runId, {
        verdict: parsed.verdict ?? null,
        confidence: parsed.confidence ?? null,
        reasoning_quality: parsed.reasoning_quality ?? null,
        action_alignment: parsed.action_alignment ?? null,
        critique: typeof parsed.critique === "string" ? parsed.critique.slice(0, 300) : null,
        disagreement_reason:
          typeof parsed.disagreement_reason === "string" ? parsed.disagreement_reason : null,
        model,
        provider: "openai",
        error: null,
      });
      return { judgment };
    } catch (err: any) {
      clearTimeout(timeout);
      const msg = err?.name === "AbortError" ? "Judge timed out (45s)" : err?.message ?? "Judge call failed";
      const j = await persistJudgment(supabase, runId, { error: msg, model, provider: "openai" });
      return { judgment: j, error: msg };
    }
  });

export const getJudgment = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { runId: string }) => input)
  .handler(async ({ data, context }): Promise<{ judgment: RunLlmJudgment | null }> => {
    const { data: row } = await (context.supabase as any)
      .from("run_llm_judgments")
      .select("*")
      .eq("run_id", data.runId)
      .maybeSingle();
    return { judgment: (row as RunLlmJudgment) ?? null };
  });

/**
 * Server-side helper: judge a run if the user has auto-judge enabled. Non-blocking,
 * non-throwing. Call with `void maybeAutoJudge(supabase, userId, runId);` from
 * evaluation hooks.
 */
export async function maybeAutoJudge(supabase: any, userId: string, runId: string): Promise<void> {
  try {
    const { data: pref } = await supabase
      .from("user_preferences")
      .select("auto_judge_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    if (!(pref as any)?.auto_judge_enabled) return;

    // Inline equivalent of judgeRun without the server-fn middleware (we already have ctx).
    const { data: run } = await supabase.from("runs").select("*").eq("id", runId).single();
    if (!run) return;
    const [recRes, parseRes, evalRes, metaRes] = await Promise.all([
      supabase.from("run_recommendations").select("*").eq("run_id", runId).maybeSingle(),
      supabase.from("run_parse_results").select("*").eq("run_id", runId).maybeSingle(),
      supabase.from("run_evaluations").select("*").eq("run_id", runId).maybeSingle(),
      supabase.from("run_metadata").select("*").eq("run_id", runId).maybeSingle(),
    ]);
    if (!evalRes.data) return;

    let groundTruth: any = null;
    if ((run as any).ground_truth_scenario_id) {
      const { data: gtActs } = await supabase
        .from("ground_truth_actions")
        .select("action_type,target_index,value")
        .eq("scenario_id", (run as any).ground_truth_scenario_id);
      if (gtActs?.length) groundTruth = { actions: gtActs };
    }

    const { baseUrl, apiKey, model } = await resolveOpenAiConfig(supabase, userId, metaRes.data);
    if (!baseUrl || !apiKey) {
      await persistJudgment(supabase, runId, {
        error: "OpenAI not configured for auto-judge.",
        model,
        provider: "openai",
      });
      return;
    }

    const messages = buildJudgeMessages({
      case_name: run.case_name,
      task: run.task,
      research_question: run.research_question ?? null,
      recommendation: recRes.data?.recommendation_text ?? "",
      parsed_action: {
        action_type: parseRes.data?.action_type ?? null,
        target_index: parseRes.data?.target_index ?? null,
        value: parseRes.data?.value ?? null,
      },
      evaluation: {
        feasibility: evalRes.data.feasibility,
        violations_found: evalRes.data.violations_found,
        violation_improvement: Number(evalRes.data.violation_improvement),
        engine_used: evalRes.data.engine_used ?? null,
        notes: evalRes.data.notes ?? null,
      },
      ground_truth: groundTruth,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.1,
          tools: [JUDGE_TOOL],
          tool_choice: { type: "function", function: { name: "submit_judgment" } },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        await persistJudgment(supabase, runId, {
          error: `Auto-judge failed (${res.status}): ${errText.slice(0, 200)}`,
          model,
          provider: "openai",
        });
        return;
      }
      const json = await res.json();
      const argsStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argsStr) {
        await persistJudgment(supabase, runId, { error: "Auto-judge returned no tool call", model, provider: "openai" });
        return;
      }
      const parsed = JSON.parse(argsStr);
      await persistJudgment(supabase, runId, {
        verdict: parsed.verdict ?? null,
        confidence: parsed.confidence ?? null,
        reasoning_quality: parsed.reasoning_quality ?? null,
        action_alignment: parsed.action_alignment ?? null,
        critique: typeof parsed.critique === "string" ? parsed.critique.slice(0, 300) : null,
        disagreement_reason:
          typeof parsed.disagreement_reason === "string" ? parsed.disagreement_reason : null,
        model,
        provider: "openai",
        error: null,
      });
    } catch (err: any) {
      clearTimeout(timeout);
      await persistJudgment(supabase, runId, {
        error: err?.name === "AbortError" ? "Auto-judge timed out (45s)" : err?.message ?? "Auto-judge failed",
        model,
        provider: "openai",
      });
    }
  } catch (err) {
    // Never throw from auto-judge.
    console.error("maybeAutoJudge swallowed error:", err);
  }
}
