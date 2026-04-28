import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { backfillEvaluations } from "@/server/evaluation.functions";

interface Props {
  /** Limit the backfill to a single batch's runs. Omit to scan all your runs. */
  batchId?: string;
  /** Called once after a successful backfill so the parent can refresh data. */
  onDone?: () => void;
}

/**
 * Triggers the backfill server function that recomputes missing evaluation
 * metrics (violation_improvement, feasibility, confidence, grounding) for
 * existing completed runs. Surfaces a toast with per-run counts.
 */
export function BackfillMetricsButton({ batchId, onDone }: Props) {
  const [running, setRunning] = useState(false);

  const handleClick = async () => {
    setRunning(true);
    try {
      const res = await backfillEvaluations({ data: { batch_id: batchId } });
      const errors = res.results.filter((r) => r.status === "error").length;
      if (res.updated === 0 && errors === 0) {
        toast.info("Metrics already up to date", {
          description: `Scanned ${res.scanned} runs · ${res.skipped} already complete`,
        });
      } else {
        toast.success(`Backfilled ${res.updated} run${res.updated === 1 ? "" : "s"}`, {
          description: `Scanned ${res.scanned} · skipped ${res.skipped}${
            errors ? ` · ${errors} error${errors === 1 ? "" : "s"}` : ""
          }`,
        });
      }
      onDone?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Backfill failed", { description: msg });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex items-center justify-end">
      <Button
        size="sm"
        variant="outline"
        onClick={handleClick}
        disabled={running}
        className="border-border/40 hover:border-primary/40"
      >
        {running ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Wand2 className="mr-1.5 h-3.5 w-3.5" />
        )}
        {running ? "Recomputing metrics…" : "Recompute missing metrics"}
      </Button>
    </div>
  );
}
