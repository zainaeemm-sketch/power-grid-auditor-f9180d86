import type { DecisionTrace } from "@/types/trace";
import type { RunEvaluation } from "@/types/grid-arena";

/**
 * Pure deterministic summarizer — walks ordered stages and produces 3-5
 * sentences describing the agent's decision flow. No LLM call.
 */
export function summarizeTrace(traces: DecisionTrace[], evaluation: RunEvaluation | null): string {
  if (!traces || traces.length === 0) return "No trace data available for this run.";

  const sentences: string[] = [];
  const byType = (t: DecisionTrace["stage_type"]) => traces.filter((x) => x.stage_type === t);

  const llm = byType("tool_use").find((t) => (t.tool_name ?? "").toLowerCase().includes("llm") || t.stage_name.toLowerCase().includes("llm"));
  const reasoning = byType("reasoning");
  const exec = byType("execution");
  const evalStages = byType("evaluation");
  const validation = byType("validation");

  if (llm) {
    sentences.push(`The agent invoked ${llm.tool_name ?? "the language model"} to analyze the case.`);
  }

  const rec = reasoning.find((r) => r.stage_name.toLowerCase().includes("recommend"));
  if (rec && rec.output_summary) {
    sentences.push(`It recommended: ${rec.output_summary.slice(0, 160)}.`);
  }

  const parser = reasoning.find((r) => r.stage_name.toLowerCase().includes("parser"));
  if (parser && parser.output_summary) {
    sentences.push(`The parser interpreted this as a ${parser.output_summary} action.`);
  }

  if (exec.length > 0) {
    const e = exec[0];
    sentences.push(`The action was applied to the network${e.output_summary ? ` (${e.output_summary})` : ""}.`);
  }

  if (evaluation) {
    const delta = evaluation.baseline_violations - evaluation.post_action_violations;
    sentences.push(
      `Evaluation: ${evaluation.feasibility}, violations went from ${evaluation.baseline_violations} to ${evaluation.post_action_violations} (${delta >= 0 ? "−" : "+"}${Math.abs(delta)}).`,
    );
  } else if (evalStages.length > 0 && evalStages[0].output_summary) {
    sentences.push(`Evaluation summary: ${evalStages[0].output_summary}.`);
  }

  if (validation.length > 0) {
    const passed = validation.filter((v) => v.status === "success").length;
    sentences.push(`Sensitivity validation ran ${validation.length} test${validation.length === 1 ? "" : "s"} (${passed} passed).`);
  }

  const failure = traces.find((t) => t.status === "failure");
  if (failure) {
    sentences.push(`A failure occurred at stage "${failure.stage_name}": ${failure.failure_reason ?? "unknown reason"}.`);
  }

  return sentences.slice(0, 6).join(" ");
}

const FAILURE_TYPE_MAP: Record<string, string> = {
  retrieval: "retrieval failure",
  planning: "planning failure",
  tool_use: "tool failure",
  reasoning: "reasoning failure",
  validation: "validation failure",
  execution: "execution failure",
  evaluation: "evaluation failure",
};

const SUGGESTED_EXPLANATIONS: Array<[RegExp, string]> = [
  [/timeout|timed out/i, "Increase the request timeout or pick a faster model."],
  [/converge|converg/i, "Try a different simulation engine or a simpler benchmark case."],
  [/api key|unauthor|401|403/i, "Verify provider credentials and access permissions."],
  [/rate limit|429/i, "Reduce concurrency or wait before retrying."],
  [/parse|invalid json/i, "Check the recommendation format — the parser could not extract a structured action."],
  [/network|fetch failed|ECONN/i, "Transient network issue; retrying the run usually resolves it."],
];

export function classifyFailure(stageType: string, reason: string | null): {
  type: string;
  suggestion: string;
} {
  const type = FAILURE_TYPE_MAP[stageType] ?? "execution failure";
  const r = reason ?? "";
  for (const [re, s] of SUGGESTED_EXPLANATIONS) {
    if (re.test(r)) return { type, suggestion: s };
  }
  return { type, suggestion: "Inspect the failure reason and re-run with the same configuration." };
}
