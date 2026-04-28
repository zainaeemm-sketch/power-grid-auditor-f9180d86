import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { RunDetails } from "@/types/grid-arena";
import type { DecisionTrace } from "@/types/trace";
import type { RunLlmJudgment } from "@/server/judge.functions";
import type { CounterfactualWithResult } from "@/server/counterfactual/types";
import type { PerturbationTestWithResult } from "@/types/grid-arena";
import type { RunListItem } from "@/server/runs.functions";

export interface AuditReportBundle {
  details: RunDetails;
  traces: DecisionTrace[];
  judgment: RunLlmJudgment | null;
  counterfactuals: CounterfactualWithResult[];
  perturbations: PerturbationTestWithResult[];
  relatedRuns: RunListItem[];
  appOrigin?: string;
}

const MARGIN = 14;

function fmt(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "object") {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

function clip(s: string, n = 600): string {
  if (!s) return "—";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function addHeading(doc: jsPDF, text: string, y: number): number {
  if (y > doc.internal.pageSize.getHeight() - 30) {
    doc.addPage();
    y = MARGIN;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text(text, MARGIN, y);
  doc.setDrawColor(180);
  doc.line(MARGIN, y + 1.5, doc.internal.pageSize.getWidth() - MARGIN, y + 1.5);
  return y + 7;
}

function addParagraph(doc: jsPDF, text: string, y: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  const maxW = doc.internal.pageSize.getWidth() - MARGIN * 2;
  const lines = doc.splitTextToSize(text || "—", maxW);
  for (const line of lines) {
    if (y > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      y = MARGIN;
    }
    doc.text(line, MARGIN, y);
    y += 4.2;
  }
  return y + 2;
}

function addKvTable(doc: jsPDF, rows: Array<[string, unknown]>, y: number): number {
  const body = rows.map(([k, v]) => [k, fmt(v)]);
  autoTable(doc, {
    startY: y,
    head: [["Field", "Value"]],
    body,
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 8, cellPadding: 1.6, overflow: "linebreak" },
    headStyles: { fillColor: [40, 50, 70], textColor: 255 },
    columnStyles: { 0: { cellWidth: 55, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
  });
  return (doc as any).lastAutoTable.finalY + 4;
}

function addTable(doc: jsPDF, head: string[], body: string[][], y: number): number {
  if (body.length === 0) {
    return addParagraph(doc, "No records.", y);
  }
  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 7.5, cellPadding: 1.4, overflow: "linebreak" },
    headStyles: { fillColor: [40, 50, 70], textColor: 255 },
  });
  return (doc as any).lastAutoTable.finalY + 4;
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.text(`GridArena Audit Report`, MARGIN, h - 6);
    doc.text(`Page ${i} / ${pageCount}`, w - MARGIN, h - 6, { align: "right" });
  }
}

export function exportAuditReportPdf(bundle: AuditReportBundle) {
  const { details, traces, judgment, counterfactuals, perturbations, relatedRuns, appOrigin } = bundle;
  const { run, metadata, promptLog, recommendation, parseResult, evaluation, groundTruth } = details;
  const m = (metadata ?? {}) as any;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  // Title block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text("GridArena Audit Report", MARGIN, y);
  y += 7;
  doc.setFontSize(11);
  doc.setTextColor(60);
  doc.text(clip(run.title || "Untitled run", 90), MARGIN, y);
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Run ID: ${run.id}`, MARGIN, y);
  y += 4;
  doc.text(`Generated: ${new Date().toISOString()}`, MARGIN, y);
  y += 6;

  // Overview
  y = addHeading(doc, "Run Overview", y);
  y = addKvTable(doc, [
    ["Title", run.title],
    ["Task", run.task],
    ["Agent", run.agent],
    ["Case", run.case_name],
    ["Status", run.status],
    ["Research question", run.research_question],
    ["Created at", run.created_at],
    ["Parent run", (run as any).parent_run_id],
    ["Re-run source", (run as any).rerun_source],
  ], y);

  // Configuration & reproducibility
  y = addHeading(doc, "Configuration & Reproducibility", y);
  y = addKvTable(doc, [
    ["Provider", m.provider_name],
    ["Provider base URL", m.provider_base_url],
    ["Model", m.model_name],
    ["Model version", m.model_version],
    ["Temperature", m.temperature],
    ["Max tokens", m.max_tokens],
    ["Top-p", m.top_p],
    ["Random seed", m.random_seed],
    ["Parser version", m.parser_version],
    ["Eval logic version", m.evaluation_logic_version],
    ["Prompt template version", m.prompt_template_version],
    ["Benchmark case version", m.benchmark_case_version],
    ["Dataset version", m.dataset_version],
    ["Executed at", m.execution_timestamp],
  ], y);

  // Prompt + response
  if (promptLog) {
    y = addHeading(doc, "Prompt", y);
    y = addParagraph(doc, clip(promptLog.prompt_text ?? "—", 1800), y);
    y = addHeading(doc, "Response", y);
    y = addParagraph(doc, clip(promptLog.response_text ?? "—", 1800), y);
  }

  if (recommendation?.recommendation_text) {
    y = addHeading(doc, "Recommendation", y);
    y = addParagraph(doc, clip(recommendation.recommendation_text, 1500), y);
  }

  // Decision trace
  y = addHeading(doc, "Decision Trace", y);
  if (!traces.length) {
    y = addParagraph(doc, "No decision-trace stages were recorded for this run.", y);
  } else {
    y = addTable(
      doc,
      ["#", "Stage", "Type", "Status", "Tool", "ms", "Output"],
      traces.map((t) => [
        String(t.sequence),
        t.stage_name,
        t.stage_type,
        t.status,
        t.tool_name ?? "—",
        String(t.execution_time_ms ?? 0),
        clip(t.output_summary ?? "—", 140),
      ]),
      y,
    );
    const failures = traces.filter((t) => t.status === "failure");
    if (failures.length) {
      y = addHeading(doc, "Trace Failures", y);
      y = addTable(
        doc,
        ["#", "Stage", "Reason"],
        failures.map((t) => [String(t.sequence), t.stage_name, clip(t.failure_reason ?? "—", 200)]),
        y,
      );
    }
  }

  // Parser provenance & structured action
  y = addHeading(doc, "Parser Provenance & Structured Action", y);
  if (!parseResult) {
    y = addParagraph(doc, "No parser output recorded.", y);
  } else {
    y = addKvTable(doc, [
      ["Action type", parseResult.action_type],
      ["Target index", parseResult.target_index],
      ["Value", parseResult.value],
      ["Enabled", parseResult.enabled],
      ["Parser notes", parseResult.parser_notes],
      ["Source text", clip(parseResult.source_text ?? "—", 400)],
      ["Parser version (run)", m.parser_version],
    ], y);
  }

  // Simulation (evaluation summary)
  y = addHeading(doc, "Simulation Evaluation", y);
  if (!evaluation) {
    y = addParagraph(doc, "No simulation evaluation recorded.", y);
  } else {
    y = addKvTable(doc, [
      ["Engine", evaluation.engine_used],
      ["Feasibility", evaluation.feasibility],
      ["Baseline violations", evaluation.baseline_violations],
      ["Post-action violations", evaluation.post_action_violations],
      ["Improvement", evaluation.violation_improvement],
      ["Confidence", evaluation.confidence],
      ["Grounding quality", evaluation.grounding_quality],
      ["Action applied", evaluation.action_applied],
      ["Action match (vs GT)", evaluation.action_match],
      ["Feasibility match (vs GT)", evaluation.feasibility_match],
      ["Optimality gap", evaluation.optimality_gap],
      ["Deviation from reference", evaluation.deviation_from_reference],
      ["Notes", evaluation.notes],
    ], y);
    const sd = evaluation.simulation_details;
    if (sd) {
      if (sd.line_loadings?.length) {
        y = addHeading(doc, "Line loadings", y);
        y = addTable(
          doc,
          ["Branch", "From", "To", "Flow MW", "Rate MW", "Loading %", "Overloaded"],
          sd.line_loadings.map((l) => [
            String(l.branch_index), String(l.from_bus), String(l.to_bus),
            l.flow_mw.toFixed(2), l.rate_mw.toFixed(2), l.loading_pct.toFixed(1),
            l.overloaded ? "yes" : "no",
          ]),
          y,
        );
      }
      if (sd.voltage_violations?.length) {
        y = addHeading(doc, "Voltage violations", y);
        y = addTable(
          doc,
          ["Bus", "Vm (pu)", "Type"],
          sd.voltage_violations.map((v) => [String(v.bus_index), v.vm_pu.toFixed(3), v.type]),
          y,
        );
      }
      if (sd.generator_violations?.length) {
        y = addHeading(doc, "Generator violations", y);
        y = addTable(
          doc,
          ["Generator", "Bus", "P (MW)", "Type"],
          sd.generator_violations.map((g) => [
            String(g.generator_index), String(g.bus), g.p_mw.toFixed(2), g.type,
          ]),
          y,
        );
      }
    }
  }

  // Counterfactuals
  y = addHeading(doc, "Counterfactual Simulations", y);
  if (!counterfactuals.length) {
    y = addParagraph(doc, "No counterfactual simulations were run.", y);
  } else {
    y = addTable(
      doc,
      ["Action", "Target", "Value", "Source", "Feasibility Δ", "Viol Δ", "Regret", "Status"],
      counterfactuals.map((c) => [
        c.action.action_type,
        fmt(c.action.target_index),
        fmt(c.action.value),
        c.action.source,
        c.result?.feasibility_change ?? "—",
        c.result ? String(c.result.violation_difference) : "—",
        c.result ? c.result.decision_regret.toFixed(2) : "—",
        c.result?.status ?? "—",
      ]),
      y,
    );
  }

  // Perturbations
  y = addHeading(doc, "Perturbation Robustness Tests", y);
  if (!perturbations.length) {
    y = addParagraph(doc, "No perturbation tests were run.", y);
  } else {
    y = addTable(
      doc,
      ["Type", "Param", "Value", "Stability", "Robustness", "Score", "Viol Δ"],
      perturbations.map((p) => [
        p.test.perturbation_type,
        p.test.parameter_name,
        fmt(p.test.parameter_value),
        p.result?.feasibility_stability ?? "—",
        p.result?.robustness_result ?? "—",
        p.result ? p.result.robustness_score.toFixed(2) : "—",
        p.result ? String(p.result.violation_change) : "—",
      ]),
      y,
    );
  }

  // LLM-as-judge scoring
  y = addHeading(doc, "LLM-as-Judge Scoring", y);
  if (!judgment) {
    y = addParagraph(doc, "No judge evaluation recorded.", y);
  } else {
    y = addKvTable(doc, [
      ["Rubric", "judge-rubric-v1"],
      ["Verdict", judgment.verdict],
      ["Confidence", judgment.confidence],
      ["Reasoning quality", judgment.reasoning_quality],
      ["Action alignment", judgment.action_alignment],
      ["Judge model", judgment.model],
      ["Provider", judgment.provider],
      ["Evaluated at", judgment.created_at],
    ], y);
    if (judgment.critique) {
      y = addHeading(doc, "Judge rationale", y);
      y = addParagraph(doc, clip(judgment.critique, 1500), y);
    }
    if (judgment.disagreement_reason) {
      y = addHeading(doc, "Disagreement reason", y);
      y = addParagraph(doc, clip(judgment.disagreement_reason, 1200), y);
    }
  }

  // Ground truth
  if (groundTruth?.scenario) {
    y = addHeading(doc, "Ground-Truth Scenario", y);
    y = addKvTable(doc, [
      ["Scenario ID", groundTruth.scenario.scenario_id],
      ["Case", groundTruth.scenario.case_name],
      ["Difficulty", groundTruth.scenario.difficulty_level],
      ["Description", groundTruth.scenario.scenario_description],
      ["Reference actions", groundTruth.actions?.length ?? 0],
    ], y);
  }

  // Related runs
  y = addHeading(doc, "Related Runs", y);
  if (!relatedRuns.length) {
    y = addParagraph(doc, "No related runs (no parent or sibling re-runs).", y);
  } else {
    const origin = appOrigin ?? "";
    y = addTable(
      doc,
      ["Relation", "Title", "Agent", "Status", "Verdict", "URL"],
      relatedRuns.map((r) => {
        const rel =
          r.id === (run as any).parent_run_id ? "parent"
          : (r as any).parent_run_id === run.id ? "child"
          : "sibling";
        return [
          rel,
          clip(r.title ?? r.id, 40),
          r.agent ?? "—",
          r.status ?? "—",
          r.judge_verdict ?? "—",
          `${origin}/runs/${r.id}`,
        ];
      }),
      y,
    );
  }

  addFooter(doc);
  doc.save(`gridarena-audit-${run.id}.pdf`);
}
