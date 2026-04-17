import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { seedDemoData } from "@/server/demo.functions";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/docs/reproducibility")({
  head: () => ({
    meta: [
      { title: "Reproducibility — GridArena Docs" },
      { name: "description", content: "Step-by-step reproduction of three GridArena experiments with expected metrics." },
      { property: "og:title", content: "Reproducibility — GridArena Docs" },
      { property: "og:description", content: "Reproduce three GridArena experiments with expected metrics." },
    ],
  }),
  component: ReproPage,
});

function ReproPage() {
  const { isAuthenticated } = useAuth();
  const [busy, setBusy] = useState(false);

  const seed = useMutation({
    mutationFn: () => seedDemoData(),
    onMutate: () => setBusy(true),
    onSuccess: (r) => toast.success("Loaded", { description: `${r.presets_created} presets, ${r.runs_created} runs.` }),
    onError: (e: Error) => toast.error("Failed", { description: e.message }),
    onSettled: () => setBusy(false),
  });

  const ExperimentMetrics = ({ rows }: { rows: Array<[string, string]> }) => (
    <div className="my-3 overflow-hidden rounded-md border border-border">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-border/50 last:border-b-0">
              <td className="bg-muted/40 px-3 py-1.5 font-medium text-foreground">{k}</td>
              <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <h1>Reproducibility</h1>
      <p>
        These three experiments are fully deterministic and use the bundled DC powerflow solver
        (no external service required). Each can be reproduced from a fresh account in under a
        minute.
      </p>

      {isAuthenticated && (
        <Button onClick={() => seed.mutate()} disabled={busy} className="my-3">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Load all three experiments
        </Button>
      )}

      <h2>Experiment 1 — Single-run sanity check</h2>
      <p><strong>Goal:</strong> verify the run pipeline end-to-end on the smallest case.</p>
      <ExperimentMetrics rows={[
        ["Preset", "[Demo] Light load relief — case5"],
        ["Case", "case5"],
        ["Action", "scale_all_loads value=0.9"],
        ["Mode", "simulation (DC solver)"],
        ["Expected feasibility", "feasible"],
        ["Expected violation_improvement", "≥ 0"],
      ]} />

      <h2>Experiment 2 — Batch-of-3 stability</h2>
      <p><strong>Goal:</strong> confirm queue + concurrency control on a small batch.</p>
      <ExperimentMetrics rows={[
        ["Presets", "All three [Demo] presets"],
        ["Concurrency", "3 (default)"],
        ["Expected completed runs", "3"],
        ["Expected failed runs", "0"],
        ["Expected total time", "≤ 30s"],
      ]} />
      <p>
        After loading, open <Link to="/batches">/batches</Link>, create a batch including the
        three demo presets, and click <strong>Run Batch</strong>. Watch progress at{" "}
        <Link to="/system-status">/system-status</Link>.
      </p>

      <h2>Experiment 3 — Validation suite</h2>
      <p>
        <strong>Goal:</strong> verify the system itself (parser, evaluator, reproducibility, batch
        stability) is healthy.
      </p>
      <ExperimentMetrics rows={[
        ["Route", "/validation"],
        ["Categories", "parser · evaluation · reproducibility · batch_stability"],
        ["Expected pass rate", "100%"],
      ]} />
      <p>
        Open <Link to="/validation">/validation</Link>, click <strong>Run All Tests</strong>, and
        wait for green badges across every category.
      </p>
    </>
  );
}
