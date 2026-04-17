import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { getRunDetails } from "@/server/runs.functions";
import type { RunDetails } from "@/types/grid-arena";
import { ReportLayout } from "@/components/reports/ReportLayout";
import { ReportSection } from "@/components/reports/ReportSection";
import { ReportTable } from "@/components/reports/ReportTable";
import { ReportToolbar } from "@/components/reports/ReportToolbar";
import { exportRunCsv } from "@/lib/csv-export";
import { exportRunLatex } from "@/lib/latex-export";

export const Route = createFileRoute("/_authenticated/reports/run/$runId")({
  head: () => ({ meta: [{ title: "Run Report — GridArena" }] }),
  loader: async ({ params }) => {
    if (typeof window === "undefined") return null;
    try {
      return await getRunDetails({ data: { runId: params.runId } });
    } catch {
      return null;
    }
  },
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <p className="text-destructive">Error loading run: {error.message}</p>
      <Button variant="outline" asChild className="mt-4"><Link to="/runs">Back to Runs</Link></Button>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <p className="text-muted-foreground">Run not found.</p>
      <Button variant="outline" asChild className="mt-4"><Link to="/runs">Back to Runs</Link></Button>
    </main>
  ),
  component: RunReportPage,
});

function RunReportPage() {
  const details = Route.useLoaderData() as RunDetails | null;
  if (!details?.run) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-8">
        <p className="text-muted-foreground">No run data.</p>
      </main>
    );
  }
  const { run, metadata, promptLog, recommendation, parseResult, evaluation } = details;
  const m = metadata ?? ({} as NonNullable<typeof metadata>);

  return (
    <>
      <div className="mx-auto max-w-4xl px-6">
        <ReportToolbar
          backTo="/runs/$runId"
          backLabel="Back to Run"
          onCsv={() => exportRunCsv(details)}
          onLatex={() => exportRunLatex(details)}
        />
      </div>
      <ReportLayout
        title={run.title}
        subtitle={`${run.agent} · ${run.case_name} · ${run.task}`}
        identifier={run.id}
        reproducibility={[
          { label: "Parser version", value: m?.parser_version },
          { label: "Eval logic version", value: m?.evaluation_logic_version },
          { label: "Benchmark case version", value: m?.benchmark_case_version },
          { label: "Prompt template version", value: m?.prompt_template_version },
          { label: "Executed at", value: m?.execution_timestamp },
          { label: "Parent run", value: run.parent_run_id },
        ]}
      >
        {run.research_question && (
          <ReportSection title="Research Question">
            <p className="text-sm leading-relaxed">{run.research_question}</p>
          </ReportSection>
        )}

        <ReportSection title="Configuration Snapshot">
          <ReportTable
            headers={["Field", "Value"]}
            rows={[
              ["Provider", m?.provider_name],
              ["Model", m?.model_name],
              ["Model version", m?.model_version],
              ["Temperature", m?.temperature],
              ["Max tokens", m?.max_tokens],
              ["Top-p", m?.top_p],
              ["Random seed", m?.random_seed],
              ["System prompt", m?.system_prompt ? `${String(m.system_prompt).slice(0, 200)}…` : null],
            ]}
          />
        </ReportSection>

        {promptLog && (
          <ReportSection title="Prompt and Response">
            <div className="space-y-4">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Prompt</p>
                <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-xs">{promptLog.prompt_text ?? "—"}</pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Response</p>
                <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-xs">{promptLog.response_text ?? "—"}</pre>
              </div>
            </div>
          </ReportSection>
        )}

        {recommendation && (
          <ReportSection title="Recommendation">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{recommendation.recommendation_text ?? "—"}</p>
          </ReportSection>
        )}

        {parseResult && (
          <ReportSection title="Parsed Action">
            <ReportTable
              headers={["Field", "Value"]}
              rows={[
                ["Action type", parseResult.action_type],
                ["Target index", parseResult.target_index],
                ["Value", parseResult.value],
                ["Enabled", String(parseResult.enabled)],
                ["Parser notes", parseResult.parser_notes],
              ]}
            />
          </ReportSection>
        )}

        {evaluation && (
          <ReportSection title="Evaluation Summary">
            <ReportTable
              headers={["Metric", "Value"]}
              rows={[
                ["Feasibility", evaluation.feasibility],
                ["Baseline violations", evaluation.baseline_violations],
                ["Post-action violations", evaluation.post_action_violations],
                ["Improvement", evaluation.violation_improvement],
                ["Confidence", evaluation.confidence],
                ["Grounding quality", evaluation.grounding_quality],
                ["Action applied", evaluation.action_applied],
              ]}
            />
            {evaluation.notes && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Notes</p>
                <p className="whitespace-pre-wrap text-sm">{evaluation.notes}</p>
              </div>
            )}
          </ReportSection>
        )}
      </ReportLayout>
    </>
  );
}
