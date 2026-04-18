import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { getBatchDetails } from "@/server/batch.functions";
import type { BatchDetails } from "@/types/grid-arena";
import { ReportLayout } from "@/components/reports/ReportLayout";
import { ReportSection } from "@/components/reports/ReportSection";
import { ReportTable } from "@/components/reports/ReportTable";
import { ReportChart } from "@/components/reports/ReportChart";
import { ReportToolbar } from "@/components/reports/ReportToolbar";
import { ExecutiveSummary } from "@/components/reports/ExecutiveSummary";
import { exportBatchCsv } from "@/lib/csv-export";
import { exportBatchLatex } from "@/lib/latex-export";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
} from "recharts";
import { useMemo } from "react";
import { agentAccuracyVsGroundTruth, accuracyRate, avgOptimalityGap, feasibilityAgreementRate } from "@/lib/batch-summary";
import { TraceAnalyticsCard } from "@/components/reports/TraceAnalyticsCard";

export const Route = createFileRoute("/_authenticated/reports/batch/$batchId")({
  head: () => ({ meta: [{ title: "Batch Report — GridArena" }] }),
  loader: async ({ params }) => {
    if (typeof window === "undefined") return null;
    try {
      return await getBatchDetails({ data: { batchId: params.batchId } });
    } catch {
      return null;
    }
  },
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <p className="text-destructive">Error loading batch: {error.message}</p>
      <Button variant="outline" asChild className="mt-4"><Link to="/batches">Back to Batches</Link></Button>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <p className="text-muted-foreground">Batch not found.</p>
      <Button variant="outline" asChild className="mt-4"><Link to="/batches">Back to Batches</Link></Button>
    </main>
  ),
  component: BatchReportPage,
});

const FEAS_COLORS: Record<string, string> = {
  feasible: "#10b981",
  infeasible: "#ef4444",
  unknown: "#a3a3a3",
};

function BatchReportPage() {
  const data = Route.useLoaderData() as BatchDetails | null;

  const chartData = useMemo(() => {
    if (!data) return { improvement: [], feasibility: [] };
    const improvement = data.runs.map((r) => ({
      name: `${r.run.agent}/${r.run.case_name}`.slice(0, 20),
      improvement: r.evaluation?.violation_improvement ?? 0,
    }));
    const feasMap = new Map<string, number>();
    for (const r of data.runs) {
      const k = r.evaluation?.feasibility ?? "unknown";
      feasMap.set(k, (feasMap.get(k) ?? 0) + 1);
    }
    const feasibility = Array.from(feasMap.entries()).map(([name, value]) => ({ name, value }));
    return { improvement, feasibility };
  }, [data]);

  if (!data?.batch) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-8">
        <p className="text-muted-foreground">No batch data.</p>
      </main>
    );
  }
  const { batch, runs } = data;
  const exportRows = runs.map((r) => ({
    run: r.run,
    evaluation: r.evaluation,
    metadata: r.metadata ?? null,
    recommendation_text: undefined,
  }));

  return (
    <>
      <div className="mx-auto max-w-4xl px-6">
        <ReportToolbar
          backTo="/batches/$batchId"
          backLabel="Back to Batch"
          onCsv={() => exportBatchCsv(exportRows, batch.id)}
          onLatex={() => exportBatchLatex(exportRows, batch.id)}
        />
      </div>
      <ReportLayout
        title={batch.name}
        subtitle={`${batch.task} · ${runs.length} run${runs.length === 1 ? "" : "s"}`}
        identifier={batch.id}
        reproducibility={[
          { label: "Batch created", value: batch.created_at },
          { label: "Last updated", value: batch.updated_at },
          { label: "Status", value: batch.status },
        ]}
      >
        {batch.research_question && (
          <ReportSection title="Research Question">
            <p className="text-sm leading-relaxed">{batch.research_question}</p>
          </ReportSection>
        )}

        <ReportSection title="Executive Summary">
          <ExecutiveSummary runs={runs} />
        </ReportSection>

        <ReportSection title="Violation Improvement per Run">
          <ReportChart
            title="Improvement (baseline − post-action violations)"
            filenameBase={`batch_${batch.id.slice(0, 8)}_improvement`}
          >
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={chartData.improvement} margin={{ top: 8, right: 16, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af40" />
                  <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={70} fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="improvement" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ReportChart>
        </ReportSection>

        <ReportSection title="Feasibility Distribution">
          <ReportChart
            title="Feasibility outcomes"
            filenameBase={`batch_${batch.id.slice(0, 8)}_feasibility`}
          >
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={chartData.feasibility} dataKey="value" nameKey="name" outerRadius={100} label>
                    {chartData.feasibility.map((entry) => (
                      <Cell key={entry.name} fill={FEAS_COLORS[entry.name] ?? "#6366f1"} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ReportChart>
        </ReportSection>

        {(() => {
          const acc = accuracyRate(runs);
          if (acc.total === 0) return null;
          const gap = avgOptimalityGap(runs);
          const feasAgree = feasibilityAgreementRate(runs);
          const perAgent = agentAccuracyVsGroundTruth(runs).map((a) => ({
            name: a.agent,
            accuracy: Math.round(a.accuracy * 100),
          }));
          return (
            <ReportSection title="Ground Truth Accuracy">
              <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-md border border-border/40 bg-background/40 p-3">
                  <div className="text-xs text-muted-foreground">Accuracy Rate</div>
                  <div className="font-mono text-lg">{(acc.rate * 100).toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">{acc.exact}/{acc.total} exact</div>
                </div>
                <div className="rounded-md border border-border/40 bg-background/40 p-3">
                  <div className="text-xs text-muted-foreground">Avg Optimality Gap</div>
                  <div className="font-mono text-lg">{gap.toFixed(2)}</div>
                </div>
                <div className="rounded-md border border-border/40 bg-background/40 p-3">
                  <div className="text-xs text-muted-foreground">Feasibility Agreement</div>
                  <div className="font-mono text-lg">{(feasAgree * 100).toFixed(1)}%</div>
                </div>
              </div>
              <ReportChart title="Agent Accuracy vs Ground Truth" filenameBase={`batch_${batch.id.slice(0, 8)}_gt_accuracy`}>
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={perAgent} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af40" />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis domain={[0, 100]} fontSize={11} unit="%" />
                      <Tooltip />
                      <Bar dataKey="accuracy" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ReportChart>
            </ReportSection>
          );
        })()}

        <TraceAnalyticsCard batchId={batch.id} />

        <ReportSection title="Run-by-Run Results">
          <ReportTable
            headers={["Run", "Agent", "Case", "Model", "Feasibility", "Improvement", "Confidence"]}
            rows={runs.map((r) => [
              r.run.id.slice(0, 8),
              r.run.agent,
              r.run.case_name,
              r.metadata?.model_name ?? "—",
              r.evaluation?.feasibility ?? "—",
              r.evaluation?.violation_improvement ?? "—",
              r.evaluation?.confidence ?? "—",
            ])}
          />
        </ReportSection>
      </ReportLayout>
    </>
  );
}
