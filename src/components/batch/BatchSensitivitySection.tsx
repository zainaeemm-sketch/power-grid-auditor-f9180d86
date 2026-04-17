import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Activity, Download, FileText } from "lucide-react";
import { BatchPerturbationJobsDialog } from "./BatchPerturbationJobsDialog";
import {
  runBatchPerturbations,
  getBatchRobustnessSummary,
  getBatchPerturbationProgress,
  type BatchRobustnessSummary,
  type BatchPerturbationProgress,
} from "@/server/perturbation.functions";
import { exportBatchSensitivityCsv } from "@/lib/csv-export";
import { useJobDrain } from "@/hooks/useJobDrain";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from "recharts";

const STABILITY_COLORS: Record<string, string> = {
  stable: "hsl(150 70% 50%)",
  degraded: "hsl(40 90% 55%)",
  failed: "hsl(0 75% 60%)",
};

export function BatchSensitivitySection({ batchId }: { batchId: string }) {
  const runFn = useServerFn(runBatchPerturbations);
  const summaryFn = useServerFn(getBatchRobustnessSummary);
  const progressFn = useServerFn(getBatchPerturbationProgress);
  const [summary, setSummary] = useState<BatchRobustnessSummary | null>(null);
  const [progress, setProgress] = useState<BatchPerturbationProgress | null>(null);
  const [enqueueing, setEnqueueing] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const prevPendingRef = useRef<number | null>(null);

  const refreshSummary = async () => {
    try {
      const s = await summaryFn({ data: { batchId } });
      setSummary(s);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load robustness summary");
    }
  };

  const refreshProgress = async () => {
    try {
      const p = await progressFn({ data: { batchId } });
      setProgress(p);
      // When pending transitions to 0, refresh summary + toast.
      if (prevPendingRef.current != null && prevPendingRef.current > 0 && p.pending === 0) {
        toast.success(`Sensitivity tests complete (${p.completed} ok, ${p.failed} failed)`);
        await refreshSummary();
      }
      prevPendingRef.current = p.pending;
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshSummary();
    refreshProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  // Drive the worker drain while jobs are pending; poll progress alongside.
  const pending = progress?.pending ?? 0;
  useJobDrain({
    enabled: pending > 0,
    intervalMs: 4000,
    onTick: () => { refreshProgress(); },
  });
  // Lightweight progress polling fallback (in case drain is idle).
  useEffect(() => {
    if (pending === 0) return;
    const t = setInterval(refreshProgress, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const handleRun = async () => {
    setEnqueueing(true);
    try {
      const { enqueued, run_count } = await runFn({ data: { batchId } });
      toast.success(`Queued sensitivity tests for ${enqueued}/${run_count} runs`);
      prevPendingRef.current = null;
      await refreshProgress();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to enqueue sensitivity tests");
    } finally {
      setEnqueueing(false);
    }
  };

  const stabilityData =
    summary?.per_test.reduce<Record<string, number>>((acc, r) => {
      acc[r.robustness_result] = (acc[r.robustness_result] ?? 0) + 1;
      return acc;
    }, {}) ?? {};
  const pieData = Object.entries(stabilityData).map(([name, value]) => ({ name, value }));

  const robustnessByAgent =
    summary?.per_run.reduce<Record<string, { total: number; n: number }>>((acc, r) => {
      const e = acc[r.agent] ?? { total: 0, n: 0 };
      if (r.avg_score != null) { e.total += r.avg_score; e.n += 1; }
      acc[r.agent] = e;
      return acc;
    }, {}) ?? {};
  const barData = Object.entries(robustnessByAgent).map(([agent, e]) => ({
    agent, score: e.n ? +(e.total / e.n).toFixed(3) : 0,
  }));

  const heatmapTypes = Array.from(new Set(summary?.per_test.map((r) => r.perturbation_type) ?? []));
  const heatmapScenarios = Array.from(new Set(summary?.per_test.map((r) => r.case_name) ?? []));
  const heatmapMap = new Map<string, number>();
  for (const r of summary?.per_test ?? []) {
    heatmapMap.set(`${r.perturbation_type}|${r.case_name}`, r.violation_change);
  }
  const heatmapMax = Math.max(1, ...Array.from(heatmapMap.values()).map((v) => Math.abs(v)));

  const chartConfig: ChartConfig = { score: { label: "Robustness", color: "hsl(150 70% 50%)" } };

  const progressPct =
    progress && progress.total > 0
      ? Math.round(((progress.completed + progress.failed) / progress.total) * 100)
      : 0;

  return (
    <Card className="mb-6 border-border/60 bg-card/60">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          Sensitivity / Robustness
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleRun} disabled={enqueueing || pending > 0}>
            {pending > 0 ? "Running…" : "Run Sensitivity Tests for Batch"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setLogsOpen(true)}>
            <FileText className="mr-1 h-3.5 w-3.5" />
            Job Logs
          </Button>
          <Button
            size="sm" variant="outline"
            onClick={() => summary && exportBatchSensitivityCsv(batchId, summary)}
            disabled={!summary?.per_test.length}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
      </CardHeader>
      <BatchPerturbationJobsDialog batchId={batchId} open={logsOpen} onOpenChange={setLogsOpen} />
      <CardContent>
        {progress && progress.total > 0 && pending > 0 && (
          <div className="mb-4 rounded border border-border/60 bg-background/40 p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Background progress · {progress.completed + progress.failed} / {progress.total} runs
                {progress.failed > 0 ? ` (${progress.failed} failed)` : ""}
              </span>
              <span>{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-1.5" />
          </div>
        )}

        {!summary || summary.total_tests === 0 ? (
          <p className="text-sm text-muted-foreground">No sensitivity tests executed.</p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Avg robustness" value={summary.avg_robustness_score?.toFixed(3) ?? "—"} />
              <Stat label="Failure rate" value={summary.failure_rate != null ? `${(summary.failure_rate * 100).toFixed(1)}%` : "—"} />
              <Stat label="Worst Δ violations" value={summary.worst_violation_change?.toString() ?? "—"} />
              <Stat label="Most sensitive" value={summary.most_sensitive_scenario ?? "—"} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Robustness by agent</p>
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="agent" fontSize={11} />
                    <YAxis domain={[0, 1]} fontSize={11} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="score" fill="hsl(150 70% 50%)" />
                  </BarChart>
                </ChartContainer>
              </div>

              <div>
                <p className="mb-2 text-xs text-muted-foreground">Feasibility stability</p>
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={70} label>
                      {pieData.map((d) => (
                        <Cell key={d.name} fill={STABILITY_COLORS[d.name] ?? "hsl(220 10% 50%)"} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              </div>
            </div>

            {heatmapTypes.length > 0 && heatmapScenarios.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs text-muted-foreground">
                  Sensitivity heatmap (Δ violations · perturbation × scenario)
                </p>
                <div className="overflow-x-auto">
                  <table className="text-xs">
                    <thead>
                      <tr>
                        <th className="px-2 py-1 text-left text-muted-foreground"></th>
                        {heatmapScenarios.map((s) => (
                          <th key={s} className="px-2 py-1 text-left text-muted-foreground">{s}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmapTypes.map((t) => (
                        <tr key={t}>
                          <td className="px-2 py-1 font-mono text-muted-foreground">{t}</td>
                          {heatmapScenarios.map((s) => {
                            const v = heatmapMap.get(`${t}|${s}`);
                            const intensity = v == null ? 0 : Math.abs(v) / heatmapMax;
                            const hue = v == null ? 220 : v > 0 ? 0 : 150;
                            return (
                              <td
                                key={s}
                                className="px-2 py-1 text-center"
                                style={{
                                  background: v == null
                                    ? "transparent"
                                    : `hsl(${hue} 75% ${60 - intensity * 25}% / ${0.2 + intensity * 0.6})`,
                                }}
                              >
                                {v ?? "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/60 bg-background/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
