import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { updateRunStatus } from "@/server/runs.functions";
import { toast } from "sonner";
import type { RunStatus } from "@/types/grid-arena";

const STATUS_FLOW: RunStatus[] = ["queued", "running", "completed"];

interface RunStatusControlsProps {
  runId: string;
  status: RunStatus;
}

export function RunStatusControls({ runId, status }: RunStatusControlsProps) {
  const router = useRouter();
  const updateStatusFn = useServerFn(updateRunStatus);
  const [updating, setUpdating] = useState(false);

  const currentIdx = STATUS_FLOW.indexOf(status);
  const nextStatus = currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;

  const changeStatus = async (newStatus: RunStatus) => {
    setUpdating(true);
    try {
      await updateStatusFn({ data: { run_id: runId, status: newStatus } });
      toast.success(`Status updated to ${newStatus}`);
      router.invalidate();
    } catch (err) {
      toast.error("Failed to update status");
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="mb-6 flex items-center gap-3 rounded-lg border border-border/40 bg-card/40 px-4 py-3">
      <span className="text-sm text-muted-foreground">Status:</span>
      <StatusBadge status={status} />
      {nextStatus && (
        <Button size="sm" variant="default" disabled={updating} onClick={() => changeStatus(nextStatus)} className="ml-auto">
          {updating ? "Updating…" : `Mark ${nextStatus}`}
        </Button>
      )}
      {!nextStatus && (
        <span className="ml-auto text-xs text-muted-foreground">Run completed</span>
      )}
    </div>
  );
}
