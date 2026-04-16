import type { RunDetails, Run, RunEvaluation } from "@/types/grid-arena";

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
  const headers = [
    "field", "value",
  ];
  const rows: string[][] = [
    ["run_id", run.id],
    ["title", run.title],
    ["task", run.task],
    ["agent", run.agent],
    ["case_name", run.case_name],
    ["status", run.status],
    ["research_question", run.research_question ?? ""],
    ["provider_name", metadata?.provider_name ?? ""],
    ["model_name", metadata?.model_name ?? ""],
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
  ];
  const csv = toCsvString(headers, rows);
  downloadCsv(csv, `run_${run.id.slice(0, 8)}_summary.csv`);
}

export function exportBatchCsv(
  runs: Array<{ run: Run; evaluation: RunEvaluation | null; recommendation_text?: string }>,
  batchId: string,
) {
  const headers = [
    "run_id", "agent", "case_name", "recommendation_text",
    "action_type", "feasibility", "baseline_violations",
    "post_action_violations", "violation_improvement",
    "confidence", "grounding_quality", "notes",
  ];
  const rows = runs.map((r) => [
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
  ]);
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
