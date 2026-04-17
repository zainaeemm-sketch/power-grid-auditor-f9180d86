import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Activity, Loader2, Play, RefreshCw } from "lucide-react";
import { listRecentJobs, cancelJob, retryJob, getJobStats, getJobLogs } from "@/server/queue/queue.functions";
import { processJobBatch } from "@/server/queue/worker.functions";
import { toast } from "sonner";
import type { JobRecord, JobLog } from "@/server/queue/types";
import { LiveIndicator, type LiveStatus } from "@/components/system-status/LiveIndicator";
import { KpiCards } from "@/components/system-status/KpiCards";
import { JobsTable } from "@/components/system-status/JobsTable";

export const Route = createFileRoute("/_authenticated/system-status")({
  head: () => ({ meta: [{ title: "System Status — GridArena" }] }),
  component: SystemStatusPage,
});

function SystemStatusPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draining, setDraining] = useState(false);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("connecting");
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
          (payload) => {
            queryClient.invalidateQueries({ queryKey: ["job-stats"] });
            queryClient.invalidateQueries({ queryKey: ["recent-jobs"] });

            if (payload.eventType === "UPDATE") {
              const newRow = payload.new as { id?: string; status?: string; job_type?: string; error_message?: string | null; payload?: { run_id?: string } | null } | null;
              const oldRow = payload.old as { status?: string } | null;
              if (newRow?.status === "failed" && oldRow?.status !== "failed" && newRow.id) {
                const jobId = newRow.id;
                toast.error(`Job failed: ${newRow.job_type ?? "unknown"}`, {
                  description: newRow.error_message ?? "See logs for details.",
                  action: {
                    label: "View logs",
                    onClick: () => {
                      setExpanded(jobId);
                      requestAnimationFrame(() => {
                        document
                          .getElementById(`job-row-${jobId}`)
                          ?.scrollIntoView({ behavior: "smooth", block: "center" });
                      });
                    },
                  },
                });
              }
              if (newRow?.status === "completed" && oldRow?.status !== "completed" && newRow.id) {
                const runId = newRow.payload?.run_id;
                toast.success(`Job completed: ${newRow.job_type ?? "unknown"}`, {
                  action: runId
                    ? {
                        label: "View result",
                        onClick: () => router.navigate({ to: "/runs/$runId", params: { runId } }),
                      }
                    : undefined,
                });
              }
            }
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
  }, [queryClient, router]);

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
    queryFn: () => (expanded ? getJobLogs({ data: { job_id: expanded } }) : Promise.resolve({ logs: [] })),
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

  const jobList = (jobs.data?.jobs ?? []) as JobRecord[];
  const logList = (logs.data?.logs ?? []) as JobLog[];

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

      <KpiCards stats={stats.data} />

      <JobsTable
        jobs={jobList}
        expanded={expanded}
        onToggleExpand={(id) => setExpanded(expanded === id ? null : id)}
        onCancel={handleCancel}
        onRetry={handleRetry}
        logs={logList}
        logsLoading={logs.isLoading}
      />
    </main>
  );
}
