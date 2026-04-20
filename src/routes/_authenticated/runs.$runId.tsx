import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@tanstack/react-router";
import { Download, RotateCw, FileText } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getRunDetails, rerunWithSameConfig } from "@/server/runs.functions";
import type { RunDetails, RunStatus } from "@/types/grid-arena";
import { exportRunCsv } from "@/lib/csv-export";

import { RunHeader } from "@/components/run-details/RunHeader";
import { RunStatusControls } from "@/components/run-details/RunStatusControls";
import { RunConfigPanel } from "@/components/run-details/RunConfigPanel";
import { RunMetadataPanel } from "@/components/run-details/RunMetadataPanel";
import { RunPromptLogPanel } from "@/components/run-details/RunPromptLogPanel";
import { RunRecommendationPanel } from "@/components/run-details/RunRecommendationPanel";
import { ParserProvenancePanel } from "@/components/run-details/ParserProvenancePanel";
import { StructuredActionPanel } from "@/components/run-details/StructuredActionPanel";
import { ResultsSummaryPanel } from "@/components/run-details/ResultsSummaryPanel";
import { ToolTracePanel } from "@/components/run-details/ToolTracePanel";
import { ProvenanceTimelinePanel } from "@/components/run-details/ProvenanceTimelinePanel";
import { GroundTruthComparisonPanel } from "@/components/run-details/GroundTruthComparisonPanel";
import { SensitivityPanel } from "@/components/run-details/SensitivityPanel";
import { DecisionTracePanel } from "@/components/run-details/DecisionTracePanel";
import { CounterfactualPanel } from "@/components/run-details/CounterfactualPanel";

export const Route = createFileRoute("/_authenticated/runs/$runId")({
  head: () => ({
    meta: [{ title: "Run Details — GridArena" }],
  }),
  loader: async ({ params }) => {
    if (typeof window === "undefined") return { run: null, metadata: null, promptLog: null, recommendation: null, parseResult: null, evaluation: null, groundTruth: null };
    try {
      return await getRunDetails({ data: { runId: params.runId } });
    } catch {
      return { run: null, metadata: null, promptLog: null, recommendation: null, parseResult: null, evaluation: null, groundTruth: null };
    }
  },
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-destructive">Error loading run: {error.message}</p>
      <Button variant="outline" asChild className="mt-4">
        <Link to="/runs">Back to Runs</Link>
      </Button>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-muted-foreground">Run not found.</p>
      <Button variant="outline" asChild className="mt-4">
        <Link to="/runs">Back to Runs</Link>
      </Button>
    </main>
  ),
  component: RunDetailPage,
});

function RunDetailPage() {
  const details = Route.useLoaderData() as RunDetails;
  const { run, metadata, promptLog, recommendation, parseResult } = details ?? {};
  const navigate = useNavigate();
  const rerunFn = useServerFn(rerunWithSameConfig);
  const [rerunning, setRerunning] = useState(false);

  if (!run) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Skeleton className="mb-4 h-8 w-2/3" />
        <Skeleton className="mb-6 h-4 w-1/3" />
        <Skeleton className="mb-4 h-14 w-full" />
        <Skeleton className="mb-4 h-32 w-full" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </main>
    );
  }

  const handleRerun = async () => {
    setRerunning(true);
    try {
      const { run: newRun } = await rerunFn({ data: { run_id: run.id } });
      toast.success("Cloned run created. Click Run to execute.");
      navigate({ to: "/runs/$runId", params: { runId: newRun.id } });
    } catch (err: any) {
      toast.error(err.message || "Failed to re-run");
    } finally {
      setRerunning(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <RunHeader run={run} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <RunStatusControls runId={run.id} status={run.status as RunStatus} />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRerun} disabled={rerunning}>
            <RotateCw className={`mr-1.5 h-3.5 w-3.5 ${rerunning ? "animate-spin" : ""}`} />
            {rerunning ? "Cloning…" : "Re-run with Same Configuration"}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/reports/run/$runId" params={{ runId: run.id }}>
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              Generate Report
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportRunCsv(details)}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export Run CSV
          </Button>
        </div>
      </div>

      {/* Phase 7 — Full configuration snapshot */}
      <div className="mb-4 grid gap-4">
        <RunConfigPanel metadata={metadata ?? null} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RunMetadataPanel runId={run.id} metadata={metadata ?? null} />
        <RunPromptLogPanel runId={run.id} promptLog={promptLog ?? null} />
        <RunRecommendationPanel runId={run.id} recommendation={recommendation ?? null} />
        <ParserProvenancePanel parseResult={parseResult ?? null} />
        <StructuredActionPanel parseResult={parseResult ?? null} />
        <ResultsSummaryPanel evaluation={details.evaluation ?? null} />
        <GroundTruthComparisonPanel
          scenario={details.groundTruth?.scenario ?? null}
          referenceActions={details.groundTruth?.actions ?? []}
          evaluation={details.evaluation ?? null}
          parseResult={parseResult ?? null}
        />
      </div>

      <div className="mt-4 grid gap-4">
        <DecisionTracePanel runId={run.id} evaluation={details.evaluation ?? null} />
        <CounterfactualPanel runId={run.id} />
        <SensitivityPanel runId={run.id} />
        <ToolTracePanel status={run.status as RunStatus} />
        <ProvenanceTimelinePanel run={run} hasParseResult={!!parseResult} />
      </div>
    </main>
  );
}
