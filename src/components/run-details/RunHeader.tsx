import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, GitBranch } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Run, RunStatus } from "@/types/grid-arena";

interface RunHeaderProps {
  run: Run;
}

export function RunHeader({ run }: RunHeaderProps) {
  const parentId = (run as any).parent_run_id as string | null | undefined;
  const rerunSource = (run as any).rerun_source as string | null | undefined;

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 rounded-xl bg-gradient-to-r from-card to-card/60 p-4 border border-border/40">
      <Button variant="ghost" size="icon" asChild>
        <Link to="/runs">
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-extrabold">
            <span className="gradient-text">{run.title}</span>
          </h1>
          <StatusBadge status={run.status as RunStatus} />
          {parentId && (
            <Link to="/runs/$runId" params={{ runId: parentId }}>
              <Badge variant="outline" className="border-primary/40 text-primary hover:bg-primary/10">
                <GitBranch className="mr-1 h-3 w-3" />
                Re-run of {parentId.slice(0, 8)}…{rerunSource ? ` (${rerunSource})` : ""}
              </Badge>
            </Link>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {run.agent} · {run.task} · {run.case_name}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-0.5 font-mono">
          {run.id.slice(0, 8)}… · {new Date(run.created_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
