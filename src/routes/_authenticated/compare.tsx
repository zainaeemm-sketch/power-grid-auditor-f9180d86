import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GitCompare, Download } from "lucide-react";
import { useState, useEffect } from "react";
import { listRuns, getRunDetails } from "@/server/runs.functions";
import type { Run, RunDetails } from "@/types/grid-arena";
import { exportComparisonCsv } from "@/lib/csv-export";

export const Route = createFileRoute("/_authenticated/compare")({
  head: () => ({
    meta: [
      { title: "Compare Runs — GridArena" },
      { name: "description", content: "Compare two experiment runs side by side." },
    ],
  }),
  loader: async () => {
    if (typeof window === "undefined") return { runs: [] };
    try {
      const result = await listRuns();
      return { runs: result.runs };
    } catch {
      return { runs: [] };
    }
  },
  component: ComparePage,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-destructive">Error: {error.message}</p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-muted-foreground">Not found.</p>
    </main>
  ),
});

function ComparePage() {
  const { runs } = Route.useLoaderData() as { runs: Run[] };
  const [runAId, setRunAId] = useState<string>("");
  const [runBId, setRunBId] = useState<string>("");
  const [detailsA, setDetailsA] = useState<RunDetails | null>(null);
  const [detailsB, setDetailsB] = useState<RunDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!runAId && !runBId) return;
    setLoading(true);
    Promise.all([
      runAId ? getRunDetails({ data: { runId: runAId } }).catch(() => null) : Promise.resolve(null),
      runBId ? getRunDetails({ data: { runId: runBId } }).catch(() => null) : Promise.resolve(null),
    ]).then(([a, b]) => {
      setDetailsA(a);
      setDetailsB(b);
      setLoading(false);
    });
  }, [runAId, runBId]);

  const handleExport = () => {
    const items = [detailsA, detailsB].filter(Boolean).map((d) => ({
      run: d!.run,
      evaluation: d!.evaluation,
    }));
    if (items.length > 0) exportComparisonCsv(items);
  };

  const sections = [
    {
      title: "Metadata",
      renderA: detailsA ? `${detailsA.metadata?.provider_name ?? "—"} / ${detailsA.metadata?.model_name ?? "—"}` : "—",
      renderB: detailsB ? `${detailsB.metadata?.provider_name ?? "—"} / ${detailsB.metadata?.model_name ?? "—"}` : "—",
    },
    {
      title: "Recommendation",
      renderA: detailsA?.recommendation?.recommendation_text ?? "—",
      renderB: detailsB?.recommendation?.recommendation_text ?? "—",
    },
    {
      title: "Parsed Action",
      renderA: detailsA?.parseResult ? `${detailsA.parseResult.action_type} (idx:${detailsA.parseResult.target_index ?? "—"}, val:${detailsA.parseResult.value ?? "—"})` : "—",
      renderB: detailsB?.parseResult ? `${detailsB.parseResult.action_type} (idx:${detailsB.parseResult.target_index ?? "—"}, val:${detailsB.parseResult.value ?? "—"})` : "—",
    },
    {
      title: "Evaluation",
      renderA: detailsA?.evaluation
        ? `Feasibility: ${detailsA.evaluation.feasibility} | Improvement: ${detailsA.evaluation.violation_improvement} | Confidence: ${detailsA.evaluation.confidence}`
        : "—",
      renderB: detailsB?.evaluation
        ? `Feasibility: ${detailsB.evaluation.feasibility} | Improvement: ${detailsB.evaluation.violation_improvement} | Confidence: ${detailsB.evaluation.confidence}`
        : "—",
    },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <GitCompare className="h-6 w-6 text-primary" />
          Compare Runs
        </h1>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!detailsA && !detailsB}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export Comparison CSV
        </Button>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Run A</Label>
          <Select value={runAId} onValueChange={setRunAId}>
            <SelectTrigger><SelectValue placeholder="Select run..." /></SelectTrigger>
            <SelectContent>
              {runs.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.title} — {r.agent}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Run B</Label>
          <Select value={runBId} onValueChange={setRunBId}>
            <SelectTrigger><SelectValue placeholder="Select run..." /></SelectTrigger>
            <SelectContent>
              {runs.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.title} — {r.agent}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && <p className="mb-4 text-sm text-muted-foreground">Loading details…</p>}

      <div className="grid gap-4">
        {sections.map((section) => (
          <Card key={section.title} className="border-border/60 bg-card/60">
            <CardHeader><CardTitle className="text-base">{section.title}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-md bg-muted/50 p-3 text-sm">{section.renderA}</div>
                <div className="rounded-md bg-muted/50 p-3 text-sm">{section.renderB}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
