import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";
import type { DecisionTrace, BatchTraceAnalytics, StageType, StageAggregate } from "@/types/trace";
import { summarizeTrace } from "@/lib/trace-explainer";

export const getRunTraces = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { runId: string }) => input)
  .handler(async ({ data, context }): Promise<{ traces: DecisionTrace[] }> => {
    const { data: rows, error } = await context.supabase
      .from("decision_traces")
      .select("*")
      .eq("run_id", data.runId)
      .order("sequence", { ascending: true });
    if (error) throw new Error(`Failed to load traces: ${error.message}`);
    return { traces: (rows ?? []) as DecisionTrace[] };
  });

export const getBatchTraceAnalytics = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { batchId: string }) => input)
  .handler(async ({ data, context }): Promise<BatchTraceAnalytics> => {
    const { data: links, error: linkErr } = await context.supabase
      .from("batch_run_links")
      .select("run_id")
      .eq("batch_id", data.batchId);
    if (linkErr) throw new Error(`Failed to load batch links: ${linkErr.message}`);
    const runIds = (links ?? []).map((l: any) => l.run_id);
    if (runIds.length === 0) {
      return { total_traces: 0, total_runs: 0, most_common_failure_stage: null, per_stage: [] };
    }
    const { data: rows, error } = await context.supabase
      .from("decision_traces")
      .select("stage_type, status, execution_time_ms")
      .in("run_id", runIds);
    if (error) throw new Error(`Failed to load traces: ${error.message}`);

    const map = new Map<StageType, { total: number; failures: number; sum_ms: number }>();
    for (const r of (rows ?? []) as Array<{ stage_type: StageType; status: string; execution_time_ms: number }>) {
      const cur = map.get(r.stage_type) ?? { total: 0, failures: 0, sum_ms: 0 };
      cur.total += 1;
      if (r.status === "failure") cur.failures += 1;
      cur.sum_ms += r.execution_time_ms ?? 0;
      map.set(r.stage_type, cur);
    }
    const per_stage: StageAggregate[] = Array.from(map.entries()).map(([stage_type, v]) => ({
      stage_type,
      total: v.total,
      failures: v.failures,
      avg_time_ms: v.total > 0 ? Math.round(v.sum_ms / v.total) : 0,
    }));
    let most: StageType | null = null;
    let mostCount = 0;
    for (const s of per_stage) {
      if (s.failures > mostCount) {
        mostCount = s.failures;
        most = s.stage_type;
      }
    }
    return {
      total_traces: rows?.length ?? 0,
      total_runs: runIds.length,
      most_common_failure_stage: most,
      per_stage,
    };
  });

export const explainTrace = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { runId: string; force?: boolean }) => input)
  .handler(async ({ data, context }): Promise<{ explanation: string; source: "llm" | "fallback" | "cache"; model?: string; cached_at?: string; error?: string }> => {
    // Cache check (unless force)
    if (!data.force) {
      const { data: runRow } = await context.supabase
        .from("runs")
        .select("ai_explanation, ai_explanation_model, ai_explanation_generated_at")
        .eq("id", data.runId)
        .maybeSingle();
      const cached = (runRow as any) ?? null;
      if (cached?.ai_explanation) {
        return {
          explanation: cached.ai_explanation,
          source: "cache",
          model: cached.ai_explanation_model ?? undefined,
          cached_at: cached.ai_explanation_generated_at ?? undefined,
        };
      }
    }

    // Load traces + evaluation
    const { data: traceRows, error: tErr } = await context.supabase
      .from("decision_traces")
      .select("*")
      .eq("run_id", data.runId)
      .order("sequence", { ascending: true });
    if (tErr) {
      return { explanation: "Unable to load trace data.", source: "fallback", error: tErr.message };
    }
    const traces = (traceRows ?? []) as DecisionTrace[];

    const { data: evalRow } = await context.supabase
      .from("run_evaluations")
      .select("*")
      .eq("run_id", data.runId)
      .maybeSingle();
    const evaluation = (evalRow as any) ?? null;

    if (traces.length === 0) {
      return { explanation: "No trace data available for this run.", source: "fallback" };
    }

    const fallback = () => summarizeTrace(traces, evaluation);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { explanation: fallback(), source: "fallback", error: "OPENAI_API_KEY not configured" };
    }

    const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");

    // Per-user model preference, fallback to env, then default
    let userModel: string | null = null;
    try {
      const { data: prefRow } = await context.supabase
        .from("user_preferences")
        .select("openai_model")
        .eq("user_id", context.userId)
        .maybeSingle();
      userModel = (prefRow as any)?.openai_model ?? null;
    } catch {
      userModel = null;
    }
    const model = userModel ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";

    const trunc = (s: string | null | undefined, n = 200) => (s ?? "").slice(0, n);
    const stageLines = traces.slice(0, 30).map((t, i) => {
      const parts = [
        `${i + 1}. [${t.stage_type}] ${t.stage_name}`,
        `status=${t.status}`,
        `time=${t.execution_time_ms}ms`,
      ];
      if (t.tool_name) parts.push(`tool=${t.tool_name}`);
      if (t.input_summary) parts.push(`in="${trunc(t.input_summary)}"`);
      if (t.output_summary) parts.push(`out="${trunc(t.output_summary)}"`);
      if (t.failure_reason) parts.push(`failure="${trunc(t.failure_reason)}"`);
      return parts.join(" | ");
    }).join("\n");

    const evalLine = evaluation
      ? `Evaluation: feasibility=${evaluation.feasibility}, baseline_violations=${evaluation.baseline_violations}, post_action_violations=${evaluation.post_action_violations}, improvement=${evaluation.violation_improvement}.`
      : "Evaluation: not available.";

    const userPrompt = `You are reviewing a power-grid LLM agent's decision pipeline.\n\nOrdered stages:\n${stageLines}\n\n${evalLine}\n\nWrite a clear, plain-English explanation in 3 to 5 sentences describing what the agent did, what it recommended, how the action affected violations, and any failures. Be concrete and specific. Do not use bullet points or headings.`;

    try {
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "You explain AI agent decision traces clearly and concisely for power-system researchers." },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        return { explanation: fallback(), source: "fallback", model, error: `OpenAI ${resp.status}: ${txt.slice(0, 200)}` };
      }
      const json = await resp.json();
      const text = json?.choices?.[0]?.message?.content?.trim();
      if (!text) {
        return { explanation: fallback(), source: "fallback", model, error: "Empty LLM response" };
      }
      return { explanation: text, source: "llm", model };
    } catch (e: any) {
      return { explanation: fallback(), source: "fallback", model, error: e?.message ?? "Network error" };
    }
  });
