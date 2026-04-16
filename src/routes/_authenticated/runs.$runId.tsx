import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { getRunDetails } from "@/server/runs.functions";
import type { RunDetails, RunStatus } from "@/types/grid-arena";

import { RunHeader } from "@/components/run-details/RunHeader";
import { RunStatusControls } from "@/components/run-details/RunStatusControls";
import { RunMetadataPanel } from "@/components/run-details/RunMetadataPanel";
import { RunPromptLogPanel } from "@/components/run-details/RunPromptLogPanel";
import { RunRecommendationPanel } from "@/components/run-details/RunRecommendationPanel";
import { ParserProvenancePanel } from "@/components/run-details/ParserProvenancePanel";
import { StructuredActionPanel } from "@/components/run-details/StructuredActionPanel";
import { ResultsSummaryPanel } from "@/components/run-details/ResultsSummaryPanel";
import { ToolTracePanel } from "@/components/run-details/ToolTracePanel";
import { ProvenanceTimelinePanel } from "@/components/run-details/ProvenanceTimelinePanel";

export const Route = createFileRoute("/_authenticated/runs/$runId")({
  head: () => ({
    meta: [{ title: "Run Details — GridArena" }],
  }),
  loader: async ({ params }) => {
    if (typeof window === "undefined") return { run: null, metadata: null, promptLog: null, recommendation: null, parseResult: null };
    try {
      return await getRunDetails({ data: { runId: params.runId } });
    } catch {
      return { run: null, metadata: null, promptLog: null, recommendation: null, parseResult: null };
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

  if (!run) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-muted-foreground">Loading run details…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <RunHeader run={run} />
      <RunStatusControls runId={run.id} status={run.status as RunStatus} />

      {/* 2-column grid for editable + read-only panels */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RunMetadataPanel runId={run.id} metadata={metadata ?? null} />
        <RunPromptLogPanel runId={run.id} promptLog={promptLog ?? null} />
        <RunRecommendationPanel runId={run.id} recommendation={recommendation ?? null} />
        <ParserProvenancePanel parseResult={parseResult ?? null} />
        <StructuredActionPanel parseResult={parseResult ?? null} />
        <ResultsSummaryPanel />
      </div>

      {/* Full-width panels */}
      <div className="mt-4 grid gap-4">
        <ToolTracePanel status={run.status as RunStatus} />
        <ProvenanceTimelinePanel run={run} hasParseResult={!!parseResult} />
      </div>
    </main>
  );
}
