import type { RunDetails, Run, RunEvaluation, RunMetadata, PerturbationTestWithResult } from "@/types/grid-arena";
import type { BatchRobustnessSummary } from "@/server/perturbation.functions";

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
