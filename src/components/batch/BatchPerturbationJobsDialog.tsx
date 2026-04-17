import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight, RefreshCw, FileText, Loader2 } from "lucide-react";
import {
  listBatchPerturbationJobs,
  getPerturbationJobLogs,
  type BatchPerturbationJob,
} from "@/server/perturbation.functions";

interface Props {
  batchId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  failed: "destructive",
  running: "secondary",
  queued: "outline",
  cancelled: "outline",
};

export function BatchPerturbationJobsDialog({ batchId, open, onOpenChange }: Props) {
  const listFn = useServerFn(listBatchPerturbationJobs);
  const logsFn = useServerFn(getPerturbationJobLogs);

  const [jobs, setJobs] = useState<BatchPerturbationJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [logs, setLogs] = useState<Array<{ id: string; level: string; message: string; metadata: any; created_at: string }>>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const { jobs } = await listFn({ data: { batchId } });
      setJobs(jobs);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      refresh();
      setSelectedJobId(null);
      setLogs([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, batchId]);

  const openLogs = async (jobId: string) => {
    setSelectedJobId(jobId);
    setLogsLoading(true);
    try {
      const { logs } = await logsFn({ data: { jobId } });
      setLogs(logs as any);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load logs");
    } finally {
      setLogsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Sensitivity Job Logs
          </DialogTitle>
          <DialogDescription>
            Background perturbation jobs for this batch. Click a row to view its logs.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{jobs.length} job(s)</p>
          <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {/* Jobs list */}
          <ScrollArea className="h-[420px] rounded border border-border/60">
            {jobs.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No sensitivity jobs found for this batch.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {jobs.map((j) => (
                  <li key={j.job_id}>
                    <button
                      type="button"
                      onClick={() => openLogs(j.job_id)}
                      className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left hover:bg-accent/40 ${
                        selectedJobId === j.job_id ? "bg-accent/60" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={STATUS_VARIANT[j.status] ?? "outline"} className="text-[10px]">
                            {j.status}
                          </Badge>
                          <span className="truncate text-xs font-medium">
                            {j.case_name ?? j.run_id.slice(0, 8)}
                          </span>
                          {j.agent && (
                            <span className="truncate text-[11px] text-muted-foreground">· {j.agent}</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          attempts {j.attempts}/{j.max_attempts}
                          {j.execution_time_ms != null ? ` · ${j.execution_time_ms}ms` : ""}
                        </p>
                        {j.error_message && (
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-destructive">{j.error_message}</p>
                        )}
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>

          {/* Logs panel */}
          <ScrollArea className="h-[420px] rounded border border-border/60 bg-background/40">
            {!selectedJobId ? (
              <p className="p-4 text-sm text-muted-foreground">Select a job to view its logs.</p>
            ) : logsLoading ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No logs recorded for this job.</p>
            ) : (
              <ul className="divide-y divide-border/40">
                {logs.map((l) => (
                  <li key={l.id} className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          l.level === "error" ? "destructive"
                          : l.level === "warn" ? "secondary"
                          : l.level === "metric" ? "default"
                          : "outline"
                        }
                        className="text-[10px]"
                      >
                        {l.level}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(l.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px]">
                      {l.message}
                    </p>
                    {l.metadata && (
                      <pre className="mt-1 overflow-x-auto rounded bg-muted/40 p-1.5 text-[10px] text-muted-foreground">
                        {JSON.stringify(l.metadata, null, 2)}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
