import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GitCompareArrows, Download } from "lucide-react";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  runBatchCounterfactuals,
  getBatchCounterfactualSummary,
  type BatchCounterfactualSummary,
} from "@/server/counterfactual.functions";
import { exportBatchCounterfactualCsv } from "@/lib/csv-export";
import { classifyOutcome } from "@/lib/counterfactual-status";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, MinusCircle, CheckCircle2 } from "lucide-react";

export function BatchCounterfactualSection({ batchId }: { batchId: string }) {
  const runFn = useServerFn(runBatchCounterfactuals);
  const summaryFn = useServerFn(getBatchCounterfactualSummary);
  const [summary, setSummary] = useState<BatchCounterfactualSummary | null>(null);
  const [running, setRunning] = useState(false);

  const refresh = async () => {
    try {
      const s = await summaryFn({ data: { batchId } });
      setSummary(s);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load counterfactual summary");
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [batchId]);

  const handleRun = async () => {
    setRunning(true);
    try {
      const { executed_runs, total_actions } = await runFn({ data: { batchId } });
      toast.success(`Executed ${total_actions} counterfactuals across ${executed_runs} runs`);
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to run batch counterfactuals");
    } finally {
      setRunning(false);
    }
  };

  const regretData = summary?.per_run.map((r) => ({
    run: r.case_name || r.run_id.slice(0, 6),
    regret: r.avg_decision_regret ?? 0,
    gap: r.avg_optimality_gap ?? 0,
  })) ?? [];

  const chartConfig: ChartConfig = {
    regret: { label: "Decision regret", color: "hsl(0 75% 60%)" },
    gap: { label: "Optimality gap", color: "hsl(40 90% 55%)" },
  };

  return (
    <Card className="mb-6 border-border/60 bg-card/60">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitCompareArrows className="h-4 w-4" />
          Counterfactual Analysis
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleRun} disabled={running}>
            {running ? "Running…" : "Run Counterfactual Analysis for Batch"}
          </Button>
          <Button
            size="sm" variant="outline"
            onClick={() => summary && exportBatchCounterfactualCsv(batchId, summary)}
            disabled={!summary?.per_action.length}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!summary || summary.total_actions === 0 ? (
          <p className="text-sm text-muted-foreground">No counterfactual analysis executed.</p>
        ) : (
          <>
            {(() => {
              const counts = { success: 0, skipped: 0, failed: 0 };
              for (const a of summary.per_action) {
                counts[classifyOutcome(a.status, a.failure_reason)] += 1;
              }
              const skippedReasons = Array.from(
                new Set(
                  summary.per_action
                    .filter((a) => classifyOutcome(a.status, a.failure_reason) === "skipped")
                    .map((a) => a.failure_reason)
                    .filter(Boolean) as string[],
                ),
              );
              return (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" /> {counts.success} success
                  </Badge>
                  {counts.skipped > 0 && (
                    <Badge variant="outline" className="gap-1 text-muted-foreground">
                      <MinusCircle className="h-3 w-3" /> {counts.skipped} skipped (no simulator)
                    </Badge>
                  )}
                  {counts.failed > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" /> {counts.failed} failed
                    </Badge>
                  )}
                  {skippedReasons.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      — {skippedReasons[0]}
                    </span>
                  )}
                </div>
              );
            })()}

            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Avg optimality gap" value={summary.avg_optimality_gap?.toFixed(3) ?? "—"} />
              <Stat label="Avg decision regret" value={summary.avg_decision_regret?.toFixed(3) ?? "—"} />
              <Stat label="Best action" value={summary.best_action_type ?? "—"} />
              <Stat label="Worst action" value={summary.worst_action_type ?? "—"} />
            </div>

            {regretData.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Decision regret & optimality gap per run</p>
                <ChartContainer config={chartConfig} className="h-[220px] w-full">
                  <BarChart data={regretData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="run" fontSize={10} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis fontSize={11} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="gap" fill="hsl(40 90% 55%)" />
                    <Bar dataKey="regret" fill="hsl(0 75% 60%)" />
                  </BarChart>
                </ChartContainer>
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
