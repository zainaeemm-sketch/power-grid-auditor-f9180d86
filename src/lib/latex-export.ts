import type { RunDetails, Run, RunEvaluation, RunMetadata } from "@/types/grid-arena";
import type { RunLlmJudgment } from "@/server/judge.functions";

function escLatex(val: unknown): string {
  if (val == null) return "";
  return String(val)
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/\n/g, " \\\\ ");
}

/**
 * Derive simulator vs LLM-judge cross-check status.
 * Returns "—" if either side is missing.
 */
function deriveCrossCheck(
  evaluation: RunEvaluation | null | undefined,
  judgment: RunLlmJudgment | null | undefined,
): string {
  if (!evaluation || !judgment || !judgment.verdict) return "—";
  const feasible = evaluation.feasibility === "feasible";
  const agree = judgment.verdict === "agree";
  if (feasible && agree) return "confirmed";
  if (feasible && !agree) return "simulator_only";
  if (!feasible && agree) return "judge_only";
  return "both_reject";
}

export function toLatexTable(
  headers: string[],
  rows: string[][],
  caption: string,
  label: string,
): string {
  const colSpec = headers.map(() => "l").join("");
  const headerRow = headers.map(escLatex).join(" & ") + " \\\\";
  const bodyRows = rows.map((r) => r.map(escLatex).join(" & ") + " \\\\").join("\n");
  return [
    "\\begin{table}[h]",
    "\\centering",
    `\\caption{${escLatex(caption)}}`,
    `\\label{tab:${label}}`,
    `\\begin{tabular}{${colSpec}}`,
    "\\toprule",
    headerRow,
    "\\midrule",
    bodyRows,
    "\\bottomrule",
    "\\end{tabular}",
    "\\end{table}",
  ].join("\n");
}

function downloadTex(content: string, filename: string) {
  const blob = new Blob([content], { type: "application/x-tex;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportRunLatex(details: RunDetails) {
  const { run, metadata, evaluation, parseResult, judgment } = details;
  const m = (metadata ?? {}) as Partial<RunMetadata>;
  const j = judgment ?? null;
  const configRows: string[][] = [
    ["Run ID", run.id],
    ["Title", run.title],
    ["Agent", run.agent],
    ["Case", run.case_name],
    ["Provider", m.provider_name ?? ""],
    ["Model", m.model_name ?? ""],
    ["Temperature", m.temperature != null ? String(m.temperature) : ""],
    ["Parser version", m.parser_version ?? ""],
    ["Eval logic version", m.evaluation_logic_version ?? ""],
    ["Executed at", m.execution_timestamp ?? ""],
  ];
  const evalRows: string[][] = [
    ["Feasibility", evaluation?.feasibility ?? "—"],
    ["Baseline violations", String(evaluation?.baseline_violations ?? "—")],
    ["Post-action violations", String(evaluation?.post_action_violations ?? "—")],
    ["Improvement", String(evaluation?.violation_improvement ?? "—")],
    ["Confidence", evaluation?.confidence ?? "—"],
    ["Grounding quality", evaluation?.grounding_quality ?? "—"],
    ["Action applied", evaluation?.action_applied ?? "—"],
    ["Parsed action", parseResult?.action_type ?? "—"],
  ];
  const judgeRows: string[][] = [
    ["Verdict", j?.verdict ?? "—"],
    ["Confidence", j?.confidence ?? "—"],
    ["Reasoning quality", j?.reasoning_quality ?? "—"],
    ["Action alignment", j?.action_alignment ?? "—"],
    ["Critique", j?.critique ?? "—"],
    ["Disagreement reason", j?.disagreement_reason ?? "—"],
    ["Model", j?.model ?? "—"],
    ["Provider", j?.provider ?? "—"],
    ["Error", j?.error ?? "—"],
    ["Cross-check status", deriveCrossCheck(evaluation, j)],
  ];
  const tex = [
    "% GridArena run report — auto-generated",
    toLatexTable(["Field", "Value"], configRows, `Configuration for run ${run.id.slice(0, 8)}`, `cfg-${run.id.slice(0, 8)}`),
    "",
    toLatexTable(["Metric", "Value"], evalRows, `Evaluation for run ${run.id.slice(0, 8)}`, `eval-${run.id.slice(0, 8)}`),
    "",
    toLatexTable(["Field", "Value"], judgeRows, `LLM judge for run ${run.id.slice(0, 8)}`, `judge-${run.id.slice(0, 8)}`),
  ].join("\n\n");
  downloadTex(tex, `run_${run.id.slice(0, 8)}_report.tex`);
}

export function exportBatchLatex(
  runs: Array<{ run: Run; evaluation: RunEvaluation | null; metadata?: RunMetadata | null; judgment?: RunLlmJudgment | null }>,
  batchId: string,
) {
  const headers = [
    "Run", "Agent", "Case", "Model",
    "Feasibility", "Improvement", "Confidence",
    "Judge verdict", "Judge confidence", "Cross-check",
  ];
  const rows = runs.map((r) => {
    const j = r.judgment ?? null;
    return [
      r.run.id.slice(0, 8),
      r.run.agent,
      r.run.case_name,
      r.metadata?.model_name ?? "",
      r.evaluation?.feasibility ?? "—",
      String(r.evaluation?.violation_improvement ?? "—"),
      r.evaluation?.confidence ?? "—",
      j?.verdict ?? "—",
      j?.confidence ?? "—",
      deriveCrossCheck(r.evaluation, j),
    ];
  });
  const tex = toLatexTable(headers, rows, `Batch ${batchId.slice(0, 8)} results`, `batch-${batchId.slice(0, 8)}`);
  downloadTex(tex, `batch_${batchId.slice(0, 8)}_report.tex`);
}

export function exportComparisonLatex(
  runs: Array<{ run: Run; evaluation: RunEvaluation | null; metadata?: RunMetadata | null; judgment?: RunLlmJudgment | null }>,
) {
  const headers = [
    "Run", "Agent", "Model",
    "Feasibility", "Improvement", "Confidence", "Grounding",
    "Judge verdict", "Judge confidence", "Cross-check",
  ];
  const rows = runs.map((r) => {
    const j = r.judgment ?? null;
    return [
      r.run.id.slice(0, 8),
      r.run.agent,
      r.metadata?.model_name ?? "",
      r.evaluation?.feasibility ?? "—",
      String(r.evaluation?.violation_improvement ?? "—"),
      r.evaluation?.confidence ?? "—",
      r.evaluation?.grounding_quality ?? "—",
      j?.verdict ?? "—",
      j?.confidence ?? "—",
      deriveCrossCheck(r.evaluation, j),
    ];
  });
  const ts = new Date().toISOString().slice(0, 10);
  const tex = toLatexTable(headers, rows, "Run comparison", `compare-${ts}`);
  downloadTex(tex, `comparison_${ts}.tex`);
}
