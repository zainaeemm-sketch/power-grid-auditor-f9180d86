import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { BatchDetails } from "@/types/grid-arena";

type RunWithEval = BatchDetails["runs"][number];

interface ChartRequirement {
  /** Chart card title shown to the user. */
  chart: string;
  /** Per-run predicate. Returns the missing-field reason, or null when ready. */
  missingFor: (run: RunWithEval) => string | null;
}

const VALID_CONFIDENCE = new Set(["low", "medium", "high"]);
const VALID_GROUNDING = new Set(["none", "ungrounded", "grounded"]);
const VALID_FEASIBILITY = new Set(["feasible", "infeasible", "unknown", "not_applicable"]);

const REQUIREMENTS: ChartRequirement[] = [
  {
    chart: "Violation Improvement by Agent",
    missingFor: (r) => {
      if (!r.evaluation) return "no run_evaluations row";
      const v = r.evaluation.violation_improvement;
      if (v === null || v === undefined) return "violation_improvement is null";
      if (Number.isNaN(Number(v))) return "violation_improvement is not numeric";
      if (!r.run.agent) return "run.agent is empty";
      return null;
    },
  },
  {
    chart: "Feasibility Rate by Agent",
    missingFor: (r) => {
      if (!r.evaluation) return "no run_evaluations row";
      const f = r.evaluation.feasibility;
      if (!f) return "feasibility is null";
      if (!VALID_FEASIBILITY.has(f)) return `feasibility="${f}" is unrecognised`;
      if (f === "unknown") return 'feasibility="unknown" — not yet evaluated';
      if (f === "not_applicable") return 'feasibility="not_applicable" — excluded from rate';
      if (!r.run.agent) return "run.agent is empty";
      return null;
    },
  },
  {
    chart: "Confidence vs Grounding",
    missingFor: (r) => {
      if (!r.evaluation) return "no run_evaluations row";
      const c = r.evaluation.confidence;
      const g = r.evaluation.grounding_quality;
      if (!c) return "confidence is null";
      if (!VALID_CONFIDENCE.has(c)) return `confidence="${c}" is unrecognised`;
      if (!g) return "grounding_quality is null";
      if (!VALID_GROUNDING.has(g)) return `grounding_quality="${g}" is unrecognised`;
      return null;
    },
  },
  {
    chart: "Case-Level Performance",
    missingFor: (r) => {
      if (!r.run.case_name) return "run.case_name is empty";
      if (!r.evaluation) return "no run_evaluations row";
      const v = r.evaluation.violation_improvement;
      if (v === null || v === undefined) return "violation_improvement is null";
      return null;
    },
  },
];

export interface ChartReadinessCheckProps {
  runs: RunWithEval[];
  /** When true the panel is collapsed-by-default if everything is ready. */
  hideWhenAllReady?: boolean;
}

/**
 * Inspects evaluation data for each run and reports, per chart, exactly which
 * fields are missing or invalid. Use this above a chart grid so users see the
 * concrete cause of empty charts instead of a blank canvas.
 */
export function ChartReadinessCheck({ runs, hideWhenAllReady = false }: ChartReadinessCheckProps) {
  if (runs.length === 0) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Chart readiness — no runs available
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Charts will appear once the batch contains at least one run.
        </CardContent>
      </Card>
    );
  }

  const report = REQUIREMENTS.map((req) => {
    const missing = runs
      .map((r) => {
        const reason = req.missingFor(r);
        return reason ? { runId: r.run.id, title: r.run.title || r.run.id.slice(0, 8), reason } : null;
      })
      .filter((x): x is { runId: string; title: string; reason: string } => x !== null);

    // Group by reason for compact display.
    const byReason = new Map<string, string[]>();
    for (const m of missing) {
      const arr = byReason.get(m.reason) ?? [];
      arr.push(m.title);
      byReason.set(m.reason, arr);
    }

    const ready = runs.length - missing.length;
    return { chart: req.chart, ready, total: runs.length, byReason };
  });

  const allReady = report.every((r) => r.ready === r.total);
  if (allReady && hideWhenAllReady) return null;

  return (
    <Card className={allReady ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {allReady ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Chart readiness — all {runs.length} runs have the data needed
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Chart readiness — some runs are missing required fields
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {report.map((row) => {
          const ok = row.ready === row.total;
          return (
            <div
              key={row.chart}
              className="rounded-lg border border-border/40 bg-background/50 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Info className="h-3.5 w-3.5 text-amber-500" />
                  )}
                  {row.chart}
                </div>
                <Badge variant={ok ? "default" : "outline"} className="text-xs">
                  {row.ready}/{row.total} ready
                </Badge>
              </div>
              {!ok && (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {Array.from(row.byReason.entries()).map(([reason, titles]) => (
                    <li key={reason} className="flex flex-wrap items-baseline gap-1.5">
                      <span className="font-mono text-amber-400">{reason}</span>
                      <span className="text-muted-foreground/70">
                        — {titles.length} run{titles.length === 1 ? "" : "s"}:{" "}
                        {titles.slice(0, 4).join(", ")}
                        {titles.length > 4 ? ` +${titles.length - 4} more` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
