import { Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, RotateCcw, X } from "lucide-react";
import type { JobRecord, JobLog } from "@/server/queue/types";

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "running") return "default";
  if (s === "completed") return "secondary";
  if (s === "failed" || s === "cancelled") return "destructive";
  return "outline";
}

interface JobsTableProps {
  jobs: JobRecord[];
  expanded: string | null;
  onToggleExpand: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  logs: JobLog[];
  logsLoading: boolean;
}

export function JobsTable({
  jobs,
  expanded,
  onToggleExpand,
  onCancel,
  onRetry,
  logs,
  logsLoading,
}: JobsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Jobs</CardTitle>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
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
                {jobs.map((j) => {
                  const isExp = expanded === j.id;
                  return (
                    <Fragment key={j.id}>
                      <tr className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2">
                          <button onClick={() => onToggleExpand(j.id)} className="text-muted-foreground">
                            {isExp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="py-2 font-mono text-xs">{j.job_type}</td>
                        <td className="py-2">
                          <Badge variant={statusVariant(j.status)}>{j.status}</Badge>
                        </td>
                        <td className="py-2">
                          {j.attempts}/{j.max_attempts}
                        </td>
                        <td className="py-2">{j.execution_time_ms ? `${j.execution_time_ms}ms` : "—"}</td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {new Date(j.created_at).toLocaleString()}
                        </td>
                        <td className="py-2 text-right">
                          {(j.status === "queued" || j.status === "running") && (
                            <Button variant="ghost" size="sm" onClick={() => onCancel(j.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                          {j.status === "failed" && (
                            <Button variant="ghost" size="sm" onClick={() => onRetry(j.id)}>
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          )}
                        </td>
                      </tr>
                      {isExp && (
                        <tr>
                          <td colSpan={7} className="bg-muted/20 px-4 py-3">
                            {j.error_message && (
                              <p className="mb-2 text-xs text-destructive">Error: {j.error_message}</p>
                            )}
                            <p className="mb-1 text-xs font-medium">Logs</p>
                            {logsLoading ? (
                              <p className="text-xs text-muted-foreground">Loading…</p>
                            ) : (
                              <ul className="space-y-1 font-mono text-xs">
                                {logs.map((l) => (
                                  <li key={l.id} className="flex gap-2">
                                    <span className="text-muted-foreground">
                                      {new Date(l.created_at).toLocaleTimeString()}
                                    </span>
                                    <span
                                      className={
                                        l.level === "error"
                                          ? "text-destructive"
                                          : l.level === "warn"
                                            ? "text-amber-500"
                                            : l.level === "metric"
                                              ? "text-primary"
                                              : ""
                                      }
                                    >
                                      [{l.level}]
                                    </span>
                                    <span>{l.message}</span>
                                  </li>
                                ))}
                                {logs.length === 0 && (
                                  <li className="text-muted-foreground">No logs yet.</li>
                                )}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
