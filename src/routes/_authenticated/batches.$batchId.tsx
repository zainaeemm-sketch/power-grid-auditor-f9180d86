import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Play, Download, CheckCircle2, XCircle, Loader2, RotateCcw } from "lucide-react";
import { useState, useCallback } from "react";
import { getBatchDetails } from "@/server/batch.functions";
import { executeRunLlm } from "@/server/llm.functions";
import type { BatchDetails, RunStatus, RunEvaluation } from "@/types/grid-arena";
import { exportBatchCsv, exportComparisonCsv } from "@/lib/csv-export";
import { toast } from "sonner";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ScatterChart, Scatter,
} from "recharts";

export const Route = createFileRoute("/_authenticated/batches/$batchId")({
  head: () => ({
    meta: [{ title: "Batch Details — GridArena" }],
  }),
  loader: async ({ params }) => {
    if (typeof window === "undefined") return null;
    try {
      return await getBatchDetails({ data: { batchId: params.batchId } });
    } catch {
      return null;
    }
  },
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-destructive">Error: {error.message}</p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-muted-foreground">Batch not found.</p>
    </main>
  ),
  component: BatchDetailPage,
});

const confidenceToNum: Record<string, number> = { low: 1, medium: 2, high: 3 };
const groundingToNum: Record<string, number> = { ungrounded: 1, none: 1, grounded: 2 };

function BatchDetailPage() {
  const data = Route.useLoaderData() as BatchDetails | null;
  const router = useRouter();
  const [executing, setExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState<{
    current: number;
    total: number;
    currentRunTitle: string;
    results: Array<{ runId: string; success: boolean; error?: string }>;
  } | null>(null);

  const batch = data?.batch;
  const runs = data?.runs ?? [];

  const handleRunAll = useCallback(async () => {
    const pendingRuns = runs.filter((r) => r.run.status !== "completed");
    if (pendingRuns.length === 0) {
      toast.info("All runs are already completed");
      return;
    }

    setExecuting(true);
    setExecutionProgress({ current: 0, total: pendingRuns.length, currentRunTitle: "", results: [] });

    const results: Array<{ runId: string; success: boolean; error?: string }> = [];

    for (let i = 0; i < pendingRuns.length; i++) {
      const r = pendingRuns[i];
      setExecutionProgress((prev) => prev ? {
        ...prev,
        current: i,
        currentRunTitle: r.run.title,
      } : prev);

      try {
        const res = await executeRunLlm({ data: { run_id: r.run.id } });
        results.push({ runId: r.run.id, success: res.success, error: res.error });
      } catch (err: any) {
        results.push({ runId: r.run.id, success: false, error: err.message });
      }

      setExecutionProgress((prev) => prev ? {
        ...prev,
        current: i + 1,
        results: [...results],
      } : prev);
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    toast.success(`Batch complete: ${succeeded} succeeded, ${failed} failed`);

    setExecuting(false);
    router.invalidate();
  }, [runs, router]);

  if (!data || !batch) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-muted-foreground">Loading batch…</p>
      </main>
    );
  }

  const completedRuns = runs.filter((r) => r.run.status === "completed");
  const progressPct = runs.length > 0 ? (completedRuns.length / runs.length) * 100 : 0;

  // Analytics
  const evalsOnly = runs.filter((r) => r.evaluation).map((r) => r.evaluation!);
  const avgImprovement = evalsOnly.length > 0
    ? evalsOnly.reduce((s, e) => s + e.violation_improvement, 0) / evalsOnly.length
    : 0;
  const feasibleCount = evalsOnly.filter((e) => e.feasibility === "feasible").length;
  const feasibilityRate = evalsOnly.length > 0 ? (feasibleCount / evalsOnly.length) * 100 : 0;

  // Per-agent aggregation
  const agentMap = new Map<string, { runs: number; feasible: number; improvement: number; confidence: number; grounding: number }>();
  runs.forEach((r) => {
    const agent = r.run.agent;
    const entry = agentMap.get(agent) ?? { runs: 0, feasible: 0, improvement: 0, confidence: 0, grounding: 0 };
    entry.runs++;
    if (r.evaluation) {
      if (r.evaluation.feasibility === "feasible") entry.feasible++;
      entry.improvement += r.evaluation.violation_improvement;
      entry.confidence += confidenceToNum[r.evaluation.confidence] ?? 0;
      entry.grounding += groundingToNum[r.evaluation.grounding_quality] ?? 0;
    }
    agentMap.set(agent, entry);
  });
  const agentStats = Array.from(agentMap.entries()).map(([agent, s]) => ({
    agent,
    runs: s.runs,
    feasibilityPct: s.runs > 0 ? Math.round((s.feasible / s.runs) * 100) : 0,
    avgImprovement: s.runs > 0 ? +(s.improvement / s.runs).toFixed(2) : 0,
    avgConfidence: s.runs > 0 ? +(s.confidence / s.runs).toFixed(2) : 0,
    avgGrounding: s.runs > 0 ? +(s.grounding / s.runs).toFixed(2) : 0,
  }));

  const bestAgent = agentStats.reduce((best, a) => a.avgImprovement > best.avgImprovement ? a : best, agentStats[0]);
  const worstAgent = agentStats.reduce((worst, a) => a.avgImprovement < worst.avgImprovement ? a : worst, agentStats[0]);

  // Per-case aggregation
  const caseMap = new Map<string, { improvement: number; count: number }>();
  runs.forEach((r) => {
    const c = r.run.case_name;
    const entry = caseMap.get(c) ?? { improvement: 0, count: 0 };
    entry.count++;
    if (r.evaluation) entry.improvement += r.evaluation.violation_improvement;
    caseMap.set(c, entry);
  });
  const caseStats = Array.from(caseMap.entries()).map(([caseName, s]) => ({
    case_name: caseName,
    avgImprovement: s.count > 0 ? +(s.improvement / s.count).toFixed(2) : 0,
  }));

  // Chart data
  const scatterData = runs.filter((r) => r.evaluation).map((r) => ({
    confidence: confidenceToNum[r.evaluation!.confidence] ?? 0,
    grounding: groundingToNum[r.evaluation!.grounding_quality] ?? 0,
    agent: r.run.agent,
  }));

  const chartConfig: ChartConfig = {
    improvement: { label: "Improvement", color: "var(--primary)" },
    feasibility: { label: "Feasibility %", color: "var(--primary)" },
    confidence: { label: "Confidence", color: "var(--primary)" },
    grounding: { label: "Grounding", color: "var(--primary)" },
  };


  const handleExportBatch = () => {
    const exportRuns = runs.map((r) => ({
      run: r.run,
      evaluation: r.evaluation,
      recommendation_text: "",
    }));
    exportBatchCsv(exportRuns, batch.id);
  };

  const handleExportComparison = () => {
    exportComparisonCsv(runs);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/batches"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{batch.name}</h1>
          <p className="text-sm text-muted-foreground">
            {batch.task} · {batch.research_question ?? "No research question"}
          </p>
        </div>
        <StatusBadge status={batch.status as RunStatus} />
      </div>

      {/* Progress & Actions */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex-1">
          <div className="mb-1 flex justify-between text-sm">
            <span>{completedRuns.length}/{runs.length} completed</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <Progress value={executing && executionProgress ? (executionProgress.current / executionProgress.total) * 100 : progressPct} />
        </div>
        <Button onClick={handleRunAll} disabled={executing}>
          {executing ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Running…</>
          ) : (
            <><Play className="mr-2 h-4 w-4" />Run All Experiments</>
          )}
        </Button>
      </div>

      {/* Live Execution Progress */}
      {executionProgress && executing && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-medium">Executing: {executionProgress.current}/{executionProgress.total}</span>
              <span className="text-muted-foreground">{Math.round((executionProgress.current / executionProgress.total) * 100)}%</span>
            </div>
            {executionProgress.currentRunTitle && (
              <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                {executionProgress.currentRunTitle}
              </p>
            )}
            {executionProgress.results.length > 0 && (
              <div className="space-y-1">
                {executionProgress.results.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {r.success ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    )}
                    <span className="truncate">{r.runId.slice(0, 8)}…</span>
                    {r.error && <span className="text-destructive">{r.error.slice(0, 60)}</span>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{runs.length}</p>
            <p className="text-xs text-muted-foreground">Total Runs</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{Math.round(feasibilityRate)}%</p>
            <p className="text-xs text-muted-foreground">Feasibility Rate</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{avgImprovement.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Avg Improvement</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{bestAgent?.agent ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Best Agent</p>
          </CardContent>
        </Card>
      </div>

      {/* Run Table */}
      <Card className="mb-6 border-border/60 bg-card/60">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Linked Runs</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportBatch}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export Batch CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportComparison}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export Comparison CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Title</th>
                  <th className="pb-2 pr-4">Agent</th>
                  <th className="pb-2 pr-4">Case</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Feasibility</th>
                  <th className="pb-2 pr-4">Improvement</th>
                  <th className="pb-2">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.run.id} className="border-b border-border/30">
                    <td className="py-2 pr-4">
                      <Link to="/runs/$runId" params={{ runId: r.run.id }} className="text-primary hover:underline">
                        {r.run.title}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{r.run.agent}</td>
                    <td className="py-2 pr-4">{r.run.case_name}</td>
                    <td className="py-2 pr-4"><StatusBadge status={r.run.status as RunStatus} /></td>
                    <td className="py-2 pr-4">{r.evaluation?.feasibility ?? "—"}</td>
                    <td className="py-2 pr-4">{r.evaluation?.violation_improvement ?? "—"}</td>
                    <td className="py-2">{r.evaluation?.confidence ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Table */}
      {agentStats.length > 0 && (
        <Card className="mb-6 border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">Agent Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Agent</th>
                    <th className="pb-2 pr-4">Runs</th>
                    <th className="pb-2 pr-4">Feasibility %</th>
                    <th className="pb-2 pr-4">Avg Improvement</th>
                    <th className="pb-2 pr-4">Avg Confidence</th>
                    <th className="pb-2">Avg Grounding</th>
                  </tr>
                </thead>
                <tbody>
                  {agentStats.map((a) => (
                    <tr key={a.agent} className="border-b border-border/30">
                      <td className="py-2 pr-4 font-medium">{a.agent}</td>
                      <td className="py-2 pr-4">{a.runs}</td>
                      <td className="py-2 pr-4">{a.feasibilityPct}%</td>
                      <td className="py-2 pr-4">{a.avgImprovement}</td>
                      <td className="py-2 pr-4">{a.avgConfidence}</td>
                      <td className="py-2">{a.avgGrounding}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      {agentStats.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Violation Improvement by Agent */}
          <Card className="border-border/60 bg-card/60">
            <CardHeader><CardTitle className="text-base">Violation Improvement by Agent</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <BarChart data={agentStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="agent" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="avgImprovement" fill="var(--color-improvement)" radius={4} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Feasibility Rate by Agent */}
          <Card className="border-border/60 bg-card/60">
            <CardHeader><CardTitle className="text-base">Feasibility Rate by Agent</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <BarChart data={agentStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="agent" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="feasibilityPct" fill="var(--color-feasibility)" radius={4} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Confidence vs Grounding Scatter */}
          <Card className="border-border/60 bg-card/60">
            <CardHeader><CardTitle className="text-base">Confidence vs Grounding</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="confidence" name="Confidence" type="number" domain={[0, 4]} />
                  <YAxis dataKey="grounding" name="Grounding" type="number" domain={[0, 3]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Scatter data={scatterData} fill="var(--color-confidence)" />
                </ScatterChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Case-Level Performance */}
          <Card className="border-border/60 bg-card/60">
            <CardHeader><CardTitle className="text-base">Case-Level Performance</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <BarChart data={caseStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="case_name" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="avgImprovement" fill="var(--color-improvement)" radius={4} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
