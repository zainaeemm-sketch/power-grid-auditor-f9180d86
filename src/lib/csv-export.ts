import type { RunDetails, Run, RunEvaluation, RunMetadata, PerturbationTestWithResult } from "@/types/grid-arena";
import type { BatchRobustnessSummary } from "@/server/perturbation.functions";
import type { CounterfactualWithResult } from "@/server/counterfactual/types";
import type { BatchCounterfactualSummary } from "@/server/counterfactual.functions";
import type { RunLlmJudgment } from "@/server/judge.functions";

/**
 * Derive simulator vs LLM-judge cross-check status.
 * Returns "" if either side is missing.
 */
function deriveCrossCheck(
  evaluation: RunEvaluation | null | undefined,
  judgment: RunLlmJudgment | null | undefined,
): string {
  if (!evaluation || !judgment || !judgment.verdict) return "";
  const feasible = evaluation.feasibility === "feasible";
  const agree = judgment.verdict === "agree";
  if (feasible && agree) return "confirmed";
  if (feasible && !agree) return "simulator_only";
  if (!feasible && agree) return "judge_only";
  return "both_reject";
}

function escCsv(val: unknown): string {
  if (val == null) return "";
  const s = String(val);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function toCsvString(headers: string[], rows: string[][]): string {
  return [headers.map(escCsv).join(","), ...rows.map((r) => r.map(escCsv).join(","))].join("\n");
}

export function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportRunCsv(details: RunDetails) {
  const { run, metadata, recommendation, parseResult, evaluation } = details;
  const m = (metadata ?? {}) as any;
  const headers = ["field", "value"];
  const rows: string[][] = [
    ["run_id", run.id],
    ["title", run.title],
    ["task", run.task],
    ["agent", run.agent],
    ["case_name", run.case_name],
    ["status", run.status],
    ["research_question", run.research_question ?? ""],
    ["parent_run_id", (run as any).parent_run_id ?? ""],
    ["rerun_source", (run as any).rerun_source ?? ""],
    ["provider_name", m.provider_name ?? ""],
    ["provider_base_url", m.provider_base_url ?? ""],
    ["model_name", m.model_name ?? ""],
    ["model_version", m.model_version ?? ""],
    ["system_prompt", m.system_prompt ?? ""],
    ["temperature", m.temperature != null ? String(m.temperature) : ""],
    ["max_tokens", m.max_tokens != null ? String(m.max_tokens) : ""],
    ["top_p", m.top_p != null ? String(m.top_p) : ""],
    ["random_seed", m.random_seed != null ? String(m.random_seed) : ""],
    ["prompt_template_version", m.prompt_template_version ?? ""],
    ["prompt_version", m.prompt_version ?? ""],
    ["dataset_version", m.dataset_version ?? ""],
    ["benchmark_case_version", m.benchmark_case_version ?? ""],
    ["parser_version", m.parser_version ?? ""],
    ["evaluation_logic_version", m.evaluation_logic_version ?? ""],
    ["execution_timestamp", m.execution_timestamp ?? ""],
    ["recommendation", recommendation?.recommendation_text ?? ""],
    ["action_type", parseResult?.action_type ?? ""],
    ["target_index", String(parseResult?.target_index ?? "")],
    ["value", String(parseResult?.value ?? "")],
    ["feasibility", evaluation?.feasibility ?? ""],
    ["violations_found", String(evaluation?.violations_found ?? "")],
    ["baseline_violations", String(evaluation?.baseline_violations ?? "")],
    ["post_action_violations", String(evaluation?.post_action_violations ?? "")],
    ["violation_improvement", String(evaluation?.violation_improvement ?? "")],
    ["confidence", evaluation?.confidence ?? ""],
    ["grounding_quality", evaluation?.grounding_quality ?? ""],
    ["action_applied", evaluation?.action_applied ?? ""],
    ["notes", evaluation?.notes ?? ""],
    ["ground_truth_scenario_id", (run as any).ground_truth_scenario_id ?? ""],
    ["action_match", (evaluation as any)?.action_match ?? ""],
    ["feasibility_match", (evaluation as any)?.feasibility_match ?? ""],
    ["optimality_gap", (evaluation as any)?.optimality_gap != null ? String((evaluation as any).optimality_gap) : ""],
  ];
  const csv = toCsvString(headers, rows);
  downloadCsv(csv, `run_${run.id.slice(0, 8)}_summary.csv`);
}

export function exportBatchCsv(
  runs: Array<{ run: Run; evaluation: RunEvaluation | null; metadata?: RunMetadata | null; recommendation_text?: string }>,
  batchId: string,
) {
  const headers = [
    "run_id", "agent", "case_name", "recommendation_text",
    "action_type", "feasibility", "baseline_violations",
    "post_action_violations", "violation_improvement",
    "confidence", "grounding_quality", "notes",
    "model_name", "system_prompt", "temperature", "max_tokens", "top_p",
    "random_seed", "prompt_template_version", "parser_version",
    "evaluation_logic_version", "benchmark_case_version", "execution_timestamp",
    "parent_run_id",
    "ground_truth_scenario_id", "action_match", "feasibility_match", "optimality_gap",
  ];
  const rows = runs.map((r) => {
    const m = (r.metadata ?? {}) as any;
    return [
      r.run.id,
      r.run.agent,
      r.run.case_name,
      r.recommendation_text ?? "",
      r.evaluation?.action_applied ?? "",
      r.evaluation?.feasibility ?? "",
      String(r.evaluation?.baseline_violations ?? ""),
      String(r.evaluation?.post_action_violations ?? ""),
      String(r.evaluation?.violation_improvement ?? ""),
      r.evaluation?.confidence ?? "",
      r.evaluation?.grounding_quality ?? "",
      r.evaluation?.notes ?? "",
      m.model_name ?? "",
      m.system_prompt ?? "",
      m.temperature != null ? String(m.temperature) : "",
      m.max_tokens != null ? String(m.max_tokens) : "",
      m.top_p != null ? String(m.top_p) : "",
      m.random_seed != null ? String(m.random_seed) : "",
      m.prompt_template_version ?? "",
      m.parser_version ?? "",
      m.evaluation_logic_version ?? "",
      m.benchmark_case_version ?? "",
      m.execution_timestamp ?? "",
      (r.run as any).parent_run_id ?? "",
      (r.run as any).ground_truth_scenario_id ?? "",
      (r.evaluation as any)?.action_match ?? "",
      (r.evaluation as any)?.feasibility_match ?? "",
      (r.evaluation as any)?.optimality_gap != null ? String((r.evaluation as any).optimality_gap) : "",
    ];
  });
  downloadCsv(toCsvString(headers, rows), `batch_${batchId.slice(0, 8)}_analytics.csv`);
}

export function exportComparisonCsv(
  runs: Array<{ run: Run; evaluation: RunEvaluation | null }>,
) {
  const headers = [
    "run_id", "agent", "case_name", "feasibility",
    "violation_improvement", "confidence", "grounding_quality",
  ];
  const rows = runs.map((r) => [
    r.run.id,
    r.run.agent,
    r.run.case_name,
    r.evaluation?.feasibility ?? "",
    String(r.evaluation?.violation_improvement ?? ""),
    r.evaluation?.confidence ?? "",
    r.evaluation?.grounding_quality ?? "",
  ]);
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  downloadCsv(toCsvString(headers, rows), `comparison_${ts}.csv`);
}

export function exportSensitivityCsv(runId: string, items: PerturbationTestWithResult[]) {
  const headers = [
    "perturbation_type", "parameter_name", "parameter_value",
    "baseline_feasibility", "perturbed_feasibility",
    "violation_change", "robustness_result", "robustness_score", "failure_reason",
  ];
  const rows = items.map(({ test, result }) => [
    test.perturbation_type,
    test.parameter_name,
    test.parameter_value != null ? String(test.parameter_value) : "",
    result?.baseline_feasibility ?? "",
    result?.perturbed_feasibility ?? "",
    result ? String(result.violation_change) : "",
    result?.robustness_result ?? "",
    result ? String(result.robustness_score) : "",
    result?.failure_reason ?? "",
  ]);
  downloadCsv(toCsvString(headers, rows), `sensitivity_run_${runId.slice(0, 8)}.csv`);
}

export function exportBatchSensitivityCsv(batchId: string, summary: BatchRobustnessSummary) {
  const headers = [
    "run_id", "case_name", "agent",
    "perturbation_type", "parameter_name", "parameter_value",
    "baseline_feasibility", "perturbed_feasibility",
    "violation_change", "robustness_result", "robustness_score", "failure_reason",
  ];
  const rows = summary.per_test.map((r) => [
    r.run_id, r.case_name, r.agent,
    r.perturbation_type, r.parameter_name,
    r.parameter_value != null ? String(r.parameter_value) : "",
    r.baseline_feasibility, r.perturbed_feasibility,
    String(r.violation_change), r.robustness_result, String(r.robustness_score),
    r.failure_reason ?? "",
  ]);
  downloadCsv(toCsvString(headers, rows), `batch_sensitivity_${batchId.slice(0, 8)}.csv`);
}

export function exportCounterfactualCsv(runId: string, items: CounterfactualWithResult[]) {
  const headers = [
    "counterfactual_action_type", "target_index", "counterfactual_value", "description",
    "baseline_action_type", "baseline_feasibility", "counterfactual_feasibility",
    "baseline_violations", "counterfactual_violations",
    "baseline_improvement", "counterfactual_improvement",
    "violation_difference", "improvement_difference",
    "optimality_gap", "decision_regret",
    "feasibility_change", "status", "failure_reason", "execution_time_ms",
  ];
  const rows = items.map(({ action, result }) => [
    action.action_type,
    action.target_index != null ? String(action.target_index) : "",
    action.value != null ? String(action.value) : "",
    action.description ?? "",
    result?.baseline_action_type ?? "",
    result?.baseline_feasibility ?? "",
    result?.counterfactual_feasibility ?? "",
    result ? String(result.baseline_violations) : "",
    result ? String(result.counterfactual_violations) : "",
    result ? String(result.baseline_improvement) : "",
    result ? String(result.counterfactual_improvement) : "",
    result ? String(result.violation_difference) : "",
    result ? String(result.improvement_difference) : "",
    result ? String(result.optimality_gap) : "",
    result ? String(result.decision_regret) : "",
    result?.feasibility_change ?? "",
    result?.status ?? "",
    result?.failure_reason ?? "",
    result ? String(result.execution_time_ms) : "",
  ]);
  downloadCsv(toCsvString(headers, rows), `counterfactual_run_${runId.slice(0, 8)}.csv`);
}

export function exportBatchCounterfactualCsv(batchId: string, summary: BatchCounterfactualSummary) {
  const headers = [
    "run_id", "case_name", "agent",
    "counterfactual_action_type", "description",
    "baseline_improvement", "counterfactual_improvement",
    "optimality_gap", "decision_regret",
    "feasibility_change", "status", "failure_reason",
  ];
  const rows = summary.per_action.map((r) => [
    r.run_id, r.case_name, r.agent,
    r.counterfactual_action_type, r.description ?? "",
    String(r.baseline_improvement), String(r.counterfactual_improvement),
    String(r.optimality_gap), String(r.decision_regret),
    r.feasibility_change, r.status, r.failure_reason ?? "",
  ]);
  downloadCsv(toCsvString(headers, rows), `batch_counterfactual_${batchId.slice(0, 8)}.csv`);
}
