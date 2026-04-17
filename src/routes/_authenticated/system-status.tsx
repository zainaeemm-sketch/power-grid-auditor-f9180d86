import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Loader2, Play, RotateCcw, X, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { listRecentJobs, cancelJob, retryJob, getJobStats, getJobLogs } from "@/server/queue/queue.functions";
import { processJobBatch } from "@/server/queue/worker.functions";
import { toast } from "sonner";
import type { JobRecord, JobLog } from "@/server/queue/types";

export const Route = createFileRoute("/_authenticated/system-status")({
  head: () => ({ meta: [{ title: "System Status — GridArena" }] }),
  component: SystemStatusPage,
});

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "running") return "default";
  if (s === "completed") return "secondary";
  if (s === "failed" || s === "cancelled") return "destructive";
  return "outline";
}

function SystemStatusPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draining, setDraining] = useState(false);
  const [liveStatus, setLiveStatus] = useState<"connecting" | "live" | "disconnected">("connecting");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectNowRef = useRef<() => void>(() => {});

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      setLiveStatus("connecting");

      channel = supabase
        .channel(`job_queue_status_${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "job_queue" },
          () => {
            queryClient.invalidateQueries({ queryKey: ["job-stats"] });
            queryClient.invalidateQueries({ queryKey: ["recent-jobs"] });
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "job_logs" },
          (payload) => {
            const jobId = (payload.new as { job_id?: string } | null)?.job_id;
            if (jobId) queryClient.invalidateQueries({ queryKey: ["job-logs", jobId] });
          },
        )
        .subscribe((status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            setLiveStatus("live");
            reconnectAttemptRef.current = 0;
            setReconnectAttempt(0);
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setLiveStatus("disconnected");
            scheduleReconnect();
          } else {
            setLiveStatus("connecting");
          }
        });
    };

    const scheduleReconnect = () => {
      if (cancelled || reconnectTimerRef.current) return;
      const attempt = reconnectAttemptRef.current + 1;
      reconnectAttemptRef.current = attempt;
      setReconnectAttempt(attempt);
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, capped at 30s, with jitter
      const base = Math.min(1000 * 2 ** (attempt - 1), 30000);
      const delay = base + Math.random() * 500;
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        if (channel) supabase.removeChannel(channel);
        connect();
      }, delay);
    };

    reconnectNowRef.current = () => {
      if (cancelled) return;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      reconnectAttemptRef.current = 0;
      setReconnectAttempt(0);
      if (channel) supabase.removeChannel(channel);
      connect();
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (channel) supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleReconnectNow = () => {
    reconnectNowRef.current();
    toast.success("Reconnecting realtime channel…");
  };

  const stats = useQuery({
    queryKey: ["job-stats"],
    queryFn: () => getJobStats(),
    refetchInterval: 5000,
  });
  const jobs = useQuery({
    queryKey: ["recent-jobs"],
    queryFn: () => listRecentJobs(),
    refetchInterval: 5000,
  });
  const logs = useQuery({
    queryKey: ["job-logs", expanded],
    queryFn: () => expanded ? getJobLogs({ data: { job_id: expanded } }) : Promise.resolve({ logs: [] }),
    enabled: !!expanded,
  });

  const handleProcessNow = async () => {
    setDraining(true);
    try {
      const r = await processJobBatch({ data: { limit: 5 } });
      toast.success(`Processed ${r.processed} jobs (${r.succeeded} ok, ${r.failed} failed)`);
      router.invalidate();
      stats.refetch();
      jobs.refetch();
    } catch (err: any) {
      toast.error(`Drain failed: ${err.message}`);
    } finally {
      setDraining(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelJob({ data: { job_id: id } });
      toast.success("Job cancelled");
      jobs.refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await retryJob({ data: { job_id: id } });
      toast.success("Job re-queued");
      jobs.refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const s = stats.data;
  const jobList = (jobs.data?.jobs ?? []) as JobRecord[];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">System Status</h1>
          <LiveIndicator status={liveStatus} reconnectAttempt={reconnectAttempt} />
          {liveStatus !== "live" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReconnectNow}
              className="h-7 px-2 text-xs"
              title="Reconnect realtime channel now (skip backoff)"
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Reconnect now
            </Button>
          )}
        </div>
        <Button onClick={handleProcessNow} disabled={draining} size="sm">
          {draining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          Process Queue Now
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <KpiCard label="Active" value={s?.active ?? 0} accent="text-primary" />
        <KpiCard label="Queued" value={s?.queued ?? 0} />
        <KpiCard label="Completed (24h)" value={s?.completed_24h ?? 0} accent="text-emerald-500" />
        <KpiCard label="Failed (24h)" value={s?.failed_24h ?? 0} accent="text-destructive" />
        <KpiCard label="Avg time (ms)" value={s?.avg_execution_ms ?? 0} />
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Jobs</CardTitle></CardHeader>
        <CardContent>
          {jobList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs yet. Run a batch to enqueue work.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="w-8 py-2"></th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Attempts</th>
                    <th className="py-2">Duration</th>
                    <th className="py-2">Created</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobList.map((j) => {
                    const isExp = expanded === j.id;
                    return (
                      <>
                        <tr key={j.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2">
                            <button onClick={() => setExpanded(isExp ? null : j.id)} className="text-muted-foreground">
                              {isExp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </td>
                          <td className="py-2 font-mono text-xs">{j.job_type}</td>
                          <td className="py-2"><Badge variant={statusVariant(j.status)}>{j.status}</Badge></td>
                          <td className="py-2">{j.attempts}/{j.max_attempts}</td>
                          <td className="py-2">{j.execution_time_ms ? `${j.execution_time_ms}ms` : "—"}</td>
                          <td className="py-2 text-xs text-muted-foreground">{new Date(j.created_at).toLocaleString()}</td>
                          <td className="py-2 text-right">
                            {(j.status === "queued" || j.status === "running") && (
                              <Button variant="ghost" size="sm" onClick={() => handleCancel(j.id)}>
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                            {j.status === "failed" && (
                              <Button variant="ghost" size="sm" onClick={() => handleRetry(j.id)}>
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            )}
                          </td>
                        </tr>
                        {isExp && (
                          <tr key={`${j.id}-exp`}>
                            <td colSpan={7} className="bg-muted/20 px-4 py-3">
                              {j.error_message && (
                                <p className="mb-2 text-xs text-destructive">Error: {j.error_message}</p>
                              )}
                              <p className="mb-1 text-xs font-medium">Logs</p>
                              {logs.isLoading ? (
                                <p className="text-xs text-muted-foreground">Loading…</p>
                              ) : (
                                <ul className="space-y-1 font-mono text-xs">
                                  {((logs.data?.logs ?? []) as JobLog[]).map((l) => (
                                    <li key={l.id} className="flex gap-2">
                                      <span className="text-muted-foreground">{new Date(l.created_at).toLocaleTimeString()}</span>
                                      <span className={
                                        l.level === "error" ? "text-destructive" :
                                        l.level === "warn" ? "text-amber-500" :
                                        l.level === "metric" ? "text-primary" : ""
                                      }>[{l.level}]</span>
                                      <span>{l.message}</span>
                                    </li>
                                  ))}
                                  {((logs.data?.logs ?? []) as JobLog[]).length === 0 && (
                                    <li className="text-muted-foreground">No logs yet.</li>
                                  )}
                                </ul>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${accent ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function LiveIndicator({ status, reconnectAttempt = 0 }: { status: "connecting" | "live" | "disconnected"; reconnectAttempt?: number }) {
  const isLive = status === "live";
  const isDown = status === "disconnected";
  const dotColor = isLive ? "bg-emerald-500" : isDown ? "bg-destructive" : "bg-amber-500";
  const baseLabel = isLive ? "Live" : isDown ? "Disconnected" : "Connecting";
  const label = !isLive && reconnectAttempt > 0 ? `${baseLabel} (retry ${reconnectAttempt})` : baseLabel;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground"
      title={`Realtime channel: ${baseLabel}${reconnectAttempt > 0 ? ` — reconnect attempt ${reconnectAttempt}` : ""}`}
    >
      <span className="relative flex h-2 w-2">
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotColor}`} />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`} />
      </span>
      {label}
    </span>
  );
}
