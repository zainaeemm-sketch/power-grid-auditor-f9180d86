import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { getRunDetails } from "@/server/runs.functions";
import type { RunDetails } from "@/types/grid-arena";
import { ReportLayout } from "@/components/reports/ReportLayout";
import { ReportSection } from "@/components/reports/ReportSection";
import { ReportTable } from "@/components/reports/ReportTable";
import { ReportChart } from "@/components/reports/ReportChart";
import { ReportToolbar } from "@/components/reports/ReportToolbar";
import { exportComparisonCsv } from "@/lib/csv-export";
import { exportComparisonLatex } from "@/lib/latex-export";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const searchSchema = z.object({
  runs: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/reports/compare")({
  head: () => ({ meta: [{ title: "Comparison Report — GridArena" }] }),
  validateSearch: zodValidator(searchSchema),
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <p className="text-destructive">Error: {error.message}</p>
      <Button variant="outline" asChild className="mt-4"><Link to="/compare">Back to Compare</Link></Button>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <p className="text-muted-foreground">Not found.</p>
    </main>
  ),
  component: CompareReportPage,
});

function CompareReportPage() {
  const { runs: runsParam } = Route.useSearch();
  const ids = useMemo(
    () => runsParam.split(",").map((s) => s.trim()).filter(Boolean),
    [runsParam],
  );
  const [details, setDetails] = useState<RunDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all(
      ids.map((id) => getRunDetails({ data: { runId: id } }).catch(() => null)),
    ).then((res) => {
      if (!active) return;
      setDetails(res.filter((r): r is RunDetails => !!r?.run));
      setLoading(false);
    });
    return () => { active = false; };
  }, [ids]);

  const chartData = useMemo(
    () =>
      details.map((d) => ({
        name: `${d.run.agent}/${d.run.case_name}`.slice(0, 20),
        improvement: d.evaluation?.violation_improvement ?? 0,
        baseline: d.evaluation?.baseline_violations ?? 0,
        postAction: d.evaluation?.post_action_violations ?? 0,
      })),
    [details],
  );

  const exportRows = details.map((d) => ({
    run: d.run,
    evaluation: d.evaluation,
    metadata: d.metadata ?? null,
  }));

  if (loading) {
    return <main className="mx-auto max-w-4xl px-6 py-8"><p className="text-muted-foreground">Loading comparison…</p></main>;
  }

  if (details.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-8">
        <p className="text-muted-foreground">No runs selected. Pass runs as <code>?runs=id1,id2</code>.</p>
        <Button variant="outline" asChild className="mt-4"><Link to="/compare">Back to Compare</Link></Button>
      </main>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-4xl px-6">
        <ReportToolbar
          backTo="/compare"
          backLabel="Back to Compare"
          onCsv={() => exportComparisonCsv(exportRows)}
          onLatex={() => exportComparisonLatex(exportRows)}
        />
      </div>
      <ReportLayout
        title="Run Comparison Report"
        subtitle={`${details.length} runs compared side by side`}
        identifier={ids.join(", ")}
      >
        <ReportSection title="Configuration Comparison">
          <ReportTable
            headers={["Run", "Agent", "Case", "Model", "Temperature", "Parser ver."]}
            rows={details.map((d) => [
              d.run.id.slice(0, 8),
              d.run.agent,
              d.run.case_name,
              d.metadata?.model_name ?? "—",
              d.metadata?.temperature ?? "—",
              d.metadata?.parser_version ?? "—",
            ])}
          />
        </ReportSection>

        <ReportSection title="Evaluation Comparison">
          <ReportTable
            headers={["Run", "Feasibility", "Baseline", "Post-action", "Improvement", "Confidence", "Grounding"]}
            rows={details.map((d) => [
              d.run.id.slice(0, 8),
              d.evaluation?.feasibility ?? "—",
              d.evaluation?.baseline_violations ?? "—",
              d.evaluation?.post_action_violations ?? "—",
              d.evaluation?.violation_improvement ?? "—",
              d.evaluation?.confidence ?? "—",
              d.evaluation?.grounding_quality ?? "—",
            ])}
          />
        </ReportSection>

        <ReportSection title="Side-by-Side Metrics">
          <ReportChart title="Violations: baseline vs post-action vs improvement" filenameBase="comparison_metrics">
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af40" />
                  <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={70} fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="baseline" fill="#94a3b8" />
                  <Bar dataKey="postAction" fill="#f59e0b" />
                  <Bar dataKey="improvement" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ReportChart>
        </ReportSection>
      </ReportLayout>
    </>
  );
}
