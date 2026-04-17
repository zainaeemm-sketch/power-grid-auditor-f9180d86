import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Target, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listScenarios, seedExampleScenarios } from "@/server/ground-truth.functions";
import type { GroundTruthScenarioListItem } from "@/types/grid-arena";

export const Route = createFileRoute("/_authenticated/ground-truth/")({
  head: () => ({
    meta: [
      { title: "Ground Truth — GridArena" },
      { name: "description", content: "Reference scenarios and expected actions for benchmarking." },
    ],
  }),
  loader: async () => {
    if (typeof window === "undefined") return { scenarios: [] };
    try {
      return await listScenarios();
    } catch {
      return { scenarios: [] };
    }
  },
  component: GroundTruthListPage,
});

function GroundTruthListPage() {
  const { scenarios } = Route.useLoaderData() as { scenarios: GroundTruthScenarioListItem[] };
  const router = useRouter();
  const seedFn = useServerFn(seedExampleScenarios);
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const { inserted } = await seedFn();
      toast.success(`Seeded ${inserted} example scenario${inserted === 1 ? "" : "s"}.`);
      await router.invalidate();
    } catch (err: any) {
      toast.error(err.message || "Failed to seed");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold"><span className="gradient-text">Ground Truth Registry</span></h1>
          <p className="mt-1 text-sm text-muted-foreground">Reference scenarios with expected optimal actions for accuracy benchmarking.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {seeding ? "Seeding…" : "Seed examples"}
          </Button>
          <Button asChild size="sm" className="bg-gradient-to-r from-primary to-[oklch(0.72_0.14_200)] text-primary-foreground">
            <Link to="/ground-truth/new">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Scenario
            </Link>
          </Button>
        </div>
      </div>

      {scenarios.length === 0 ? (
        <Card className="border-border/40 bg-card/60">
          <CardContent className="py-12 text-center">
            <Target className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">No ground truth scenarios yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">Click "Seed examples" to add sample scenarios or "New Scenario" to create your own.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {scenarios.map((s) => (
            <Link key={s.id} to="/ground-truth/$id" params={{ id: s.id }}>
              <Card className="border-border/40 bg-card/60 transition hover:border-primary/40">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm font-bold">
                    <span className="font-mono text-primary">{s.scenario_id}</span>
                    <Badge variant="outline" className="text-xs">{s.difficulty_level}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-xs">
                  <div><span className="text-muted-foreground">Case:</span> {s.case_name}</div>
                  <div className="line-clamp-2 text-muted-foreground">{s.scenario_description || "—"}</div>
                  <div><span className="text-muted-foreground">Reference actions:</span> {s.action_count}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
