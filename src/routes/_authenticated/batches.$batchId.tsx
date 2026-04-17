import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Play, Download, CheckCircle2, XCircle, Loader2, RotateCcw, Volume2, VolumeX, Bell, BellOff, Keyboard, FileText } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBatchDetails } from "@/server/batch.functions";
import { executeRunLlm } from "@/server/llm.functions";
import type { BatchDetails, RunStatus, RunEvaluation } from "@/types/grid-arena";
import { exportBatchCsv, exportComparisonCsv } from "@/lib/csv-export";
import { requestNotificationPermission, notifyBatchComplete, isSoundEnabled, setSoundEnabled, isBrowserNotifEnabled, setBrowserNotifEnabled } from "@/lib/notifications";
import { useJobDrain } from "@/hooks/useJobDrain";
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
  const [retryingRunId, setRetryingRunId] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
  const [notifOn, setNotifOn] = useState(() => isBrowserNotifEnabled());
  const [executionProgress, setExecutionProgress] = useState<{
    current: number;
    total: number;
    currentRunTitle: string;
    results: Array<{ runId: string; success: boolean; error?: string }>;
  } | null>(null);

  const batch = data?.batch;
  const runs = data?.runs ?? [];

  // Extract run IDs for realtime filtering
  const runIds = useMemo(() => runs.map((r) => r.run.id), [runs]);

  // Realtime subscription for run status updates with toast notifications
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedCountRef = useRef(runs.filter((r) => r.run.status === "completed").length);

  useEffect(() => {
    completedCountRef.current = runs.filter((r) => r.run.status === "completed").length;
  }, [runs]);

  useEffect(() => {
    if (runIds.length === 0 || !batch) return;
    const channel = supabase
      .channel(`batch-${batch.id}-runs`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'runs' },
        (payload: any) => {
          if (runIds.includes(payload.new?.id)) {
            const newStatus = payload.new?.status;
            const runTitle = payload.new?.title ?? payload.new?.id?.slice(0, 8);

            if (newStatus === 'completed') {
              const newCount = completedCountRef.current + 1;
              completedCountRef.current = newCount;
              toast.success(`Run completed: ${runTitle}`, {
                description: `${newCount}/${runIds.length} runs finished`,
              });
            } else if (newStatus === 'running') {
              toast(`Run started: ${runTitle}`, {
                description: 'LLM execution in progress…',
              });
            }

            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
              router.invalidate();
            }, 300);
          }
        }
      )
      .subscribe();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [batch?.id, runIds, router]);

  const handleRunAll = useCallback(async () => {
    const pendingRuns = runs.filter((r) => r.run.status !== "completed");
    if (pendingRuns.length === 0) {
      toast.info("All runs are already completed");
      return;
    }

    await requestNotificationPermission();
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
    notifyBatchComplete(succeeded, failed);

    setExecuting(false);
    router.invalidate();
  }, [runs, router]);

  const handleRetryRun = useCallback(async (runId: string) => {
    setRetryingRunId(runId);
    try {
      const res = await executeRunLlm({ data: { run_id: runId } });
      setExecutionProgress((prev) => {
        if (!prev) return prev;
        const updated = prev.results.map((r) =>
          r.runId === runId ? { runId, success: res.success, error: res.error } : r
        );
        return { ...prev, results: updated };
      });
      if (res.success) {
        toast.success("Run retried successfully");
      } else {
        toast.error(`Retry failed: ${res.error}`);
      }
      router.invalidate();
    } catch (err: any) {
      toast.error(`Retry failed: ${err.message}`);
    } finally {
      setRetryingRunId(null);
    }
  }, [router]);

  const handleRetryAllFailed = useCallback(async () => {
    if (!executionProgress) return;
    const failedResults = executionProgress.results.filter((r) => !r.success);
    if (failedResults.length === 0) return;

    setRetryingAll(true);
    let succeeded = 0;
    let failed = 0;

    for (const fr of failedResults) {
      setRetryingRunId(fr.runId);
      try {
        const res = await executeRunLlm({ data: { run_id: fr.runId } });
        setExecutionProgress((prev) => {
          if (!prev) return prev;
          const updated = prev.results.map((r) =>
            r.runId === fr.runId ? { runId: fr.runId, success: res.success, error: res.error } : r
          );
          return { ...prev, results: updated };
        });
        if (res.success) succeeded++;
        else failed++;
      } catch (err: any) {
        setExecutionProgress((prev) => {
          if (!prev) return prev;
          const updated = prev.results.map((r) =>
            r.runId === fr.runId ? { runId: fr.runId, success: false, error: err.message } : r
          );
          return { ...prev, results: updated };
        });
        failed++;
      }
    }

    setRetryingRunId(null);
    setRetryingAll(false);
    toast.success(`Retry complete: ${succeeded} succeeded, ${failed} still failed`);
    notifyBatchComplete(succeeded, failed);
    router.invalidate();
  }, [executionProgress, router]);

  // Keyboard shortcuts (use refs to avoid forward-reference issues with export handlers)
  const handlersRef = useRef<{ exportBatch?: () => void; exportComparison?: () => void }>({});
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === 'Enter' && !executing) {
        e.preventDefault();
        handleRunAll();
      }
      if (mod && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        e.preventDefault();
        handlersRef.current.exportComparison?.();
      } else if (mod && e.key === 'e') {
        e.preventDefault();
        handlersRef.current.exportBatch?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [executing, handleRunAll]);

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
      metadata: r.metadata ?? null,
      recommendation_text: "",
    }));
    exportBatchCsv(exportRuns, batch.id);
  };

  const handleExportComparison = () => {
    exportComparisonCsv(runs);
  };

  // Phase 7 — config consistency check across runs in the batch
  const consistencyKeys = ["model_name", "temperature", "prompt_template_version", "parser_version", "evaluation_logic_version"] as const;
  const metadataList = runs.map((r) => (r.metadata ?? {}) as any).filter((m) => Object.keys(m).length > 0);
  const consistencyDiffs: string[] = [];
  if (metadataList.length > 1) {
    for (const k of consistencyKeys) {
      const set = new Set(metadataList.map((m) => JSON.stringify(m[k] ?? null)));
      if (set.size > 1) consistencyDiffs.push(k);
    }
  }
  const allIdentical = consistencyDiffs.length === 0 && metadataList.length > 0;

  // Wire refs for keyboard shortcuts
  handlersRef.current.exportBatch = handleExportBatch;
  handlersRef.current.exportComparison = handleExportComparison;

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
        {metadataList.length > 0 && (
          allIdentical ? (
            <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary" title="All runs share the same key configuration">
              ✓ All runs identical config
            </span>
          ) : (
            <span
              className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-500"
              title={`Runs differ on: ${consistencyDiffs.join(", ")}`}
            >
              ⚠ Configs differ ({consistencyDiffs.length})
            </span>
          )
        )}
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
        <Button onClick={handleRunAll} disabled={executing} title="Run All Experiments (Ctrl+Enter)">
          {executing ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Running…</>
          ) : (
            <><Play className="mr-2 h-4 w-4" />Run All Experiments</>
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          title={soundOn ? "Mute completion sound" : "Enable completion sound"}
          onClick={() => { const next = !soundOn; setSoundOn(next); setSoundEnabled(next); }}
        >
          {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          title={notifOn ? "Disable browser notifications" : "Enable browser notifications"}
          onClick={async () => {
            const next = !notifOn;
            setNotifOn(next);
            setBrowserNotifEnabled(next);
            if (next) await requestNotificationPermission();
          }}
        >
          {notifOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" title="Keyboard shortcuts">
              <Keyboard className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="end">
            <p className="mb-2 text-sm font-medium">Keyboard Shortcuts</p>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Run All Experiments</span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘↵</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Export Batch CSV</span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘E</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Export Comparison CSV</span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘⇧E</kbd>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {executionProgress && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            {executing && (
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="font-medium">Executing: {executionProgress.current}/{executionProgress.total}</span>
                <span className="text-muted-foreground">{Math.round((executionProgress.current / executionProgress.total) * 100)}%</span>
              </div>
            )}
            {executing && executionProgress.currentRunTitle && (
              <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                {executionProgress.currentRunTitle}
              </p>
            )}
            {!executing && executionProgress.results.some((r) => !r.success) && (
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  Completed — {executionProgress.results.filter((r) => !r.success).length} failed run(s)
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={retryingAll || retryingRunId !== null}
                    >
                      {retryingAll ? (
                        <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Retrying…</>
                      ) : (
                        <><RotateCcw className="mr-1 h-3 w-3" />Retry All Failed</>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Retry all failed runs?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will re-execute {executionProgress.results.filter((r) => !r.success).length} failed run(s). Each run will call the LLM again and overwrite previous results.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleRetryAllFailed}>
                        Retry All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
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
                    {r.error && <span className="truncate text-destructive">{r.error.slice(0, 60)}</span>}
                    {!r.success && !executing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-6 px-2 text-xs"
                        disabled={retryingRunId === r.runId}
                        onClick={() => handleRetryRun(r.runId)}
                      >
                        {retryingRunId === r.runId ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="mr-1 h-3 w-3" />
                        )}
                        Retry
                      </Button>
                    )}
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
            <Button variant="outline" size="sm" asChild>
              <Link to="/reports/batch/$batchId" params={{ batchId: batch.id }}>
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Generate Report
              </Link>
            </Button>
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
