import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getScenario, deleteScenario } from "@/server/ground-truth.functions";
import type { GroundTruthScenarioWithActions } from "@/types/grid-arena";

export const Route = createFileRoute("/_authenticated/ground-truth/$id")({
  head: () => ({ meta: [{ title: "Ground Truth Scenario — GridArena" }] }),
  loader: async ({ params }) => {
    if (typeof window === "undefined") return null;
    try {
      return await getScenario({ data: { id: params.id } });
    } catch {
      return null;
    }
  },
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <p className="text-destructive">Error: {error.message}</p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <p className="text-muted-foreground">Scenario not found.</p>
    </main>
  ),
  component: ScenarioDetailPage,
});

function ScenarioDetailPage() {
  const data = Route.useLoaderData() as GroundTruthScenarioWithActions | null;
  const navigate = useNavigate();
  const deleteFn = useServerFn(deleteScenario);

  if (!data) {
    return <main className="mx-auto max-w-4xl px-4 py-8"><p className="text-muted-foreground">Loading…</p></main>;
  }
  const { scenario, actions } = data;

  const handleDelete = async () => {
    if (!confirm("Delete this scenario and all its reference actions?")) return;
    try {
      await deleteFn({ data: { id: scenario.id } });
      toast.success("Scenario deleted");
      navigate({ to: "/ground-truth" });
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="outline" size="sm" asChild>
          <Link to="/ground-truth"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Back</Link>
        </Button>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete
        </Button>
      </div>

      <Card className="mb-4 border-border/40 bg-card/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <span className="font-mono text-primary">{scenario.scenario_id}</span>
            <Badge variant="outline">{scenario.difficulty_level}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">Case:</span> {scenario.case_name}</div>
          <div><span className="text-muted-foreground">Description:</span> {scenario.scenario_description || "—"}</div>
        </CardContent>
      </Card>

      <Card className="border-border/40 bg-card/60">
        <CardHeader><CardTitle className="text-base font-bold">Reference Actions ({actions.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reference actions.</p>
          ) : actions.map((a: typeof actions[number]) => (
            <div key={a.id} className="rounded-md border border-border/40 bg-background/40 p-3 text-xs">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <div><span className="text-muted-foreground">type:</span> <span className="font-mono">{a.action_type}</span></div>
                <div><span className="text-muted-foreground">target_index:</span> <span className="font-mono">{a.target_index ?? "—"}</span></div>
                <div><span className="text-muted-foreground">value:</span> <span className="font-mono">{a.value ?? "—"}</span></div>
                <div><span className="text-muted-foreground">feasibility:</span> <span className="font-mono">{String(a.expected_feasibility)}</span></div>
                <div><span className="text-muted-foreground">violations:</span> <span className="font-mono">{a.expected_violations}</span></div>
                <div><span className="text-muted-foreground">improvement:</span> <span className="font-mono">{String(a.expected_violation_improvement)}</span></div>
              </div>
              {a.notes && <p className="mt-2 text-muted-foreground">{a.notes}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
