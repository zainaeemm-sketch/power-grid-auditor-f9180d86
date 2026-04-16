import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, Plus } from "lucide-react";
import { useState } from "react";
import { listRuns } from "@/server/runs.functions";
import type { Run, RunStatus } from "@/types/grid-arena";

export const Route = createFileRoute("/_authenticated/runs/")({
  head: () => ({
    meta: [
      { title: "Runs — GridArena" },
      { name: "description", content: "Browse and search experiment runs." },
    ],
  }),
  loader: async () => {
    if (typeof window === "undefined") return { runs: [], error: null };
    try {
      const result = await listRuns();
      return { ...result, error: null };
    } catch (err: any) {
      return { runs: [], error: err.message ?? "Failed to load runs" };
    }
  },
  component: RunsPage,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
        <p className="text-destructive font-medium">Failed to load runs</p>
        <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
      </div>
    </main>
  ),
});

function RunsPage() {
  const { runs, error } = Route.useLoaderData() as { runs: Run[]; error: string | null };
  const [search, setSearch] = useState("");
  const [search, setSearch] = useState("");

  const filtered = runs.filter(
    (r: Run) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.agent.toLowerCase().includes(search.toLowerCase()) ||
      r.task.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Experiment Runs</h1>
        <Button asChild>
          <Link to="/new-run">
            <Plus className="mr-2 h-4 w-4" />
            New Run
          </Link>
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search runs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((run: Run) => (
          <Link key={run.id} to="/runs/$runId" params={{ runId: run.id }} className="block">
            <Card className="border-border/60 bg-card/60 transition-colors hover:border-primary/40">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex flex-col gap-1">
                  <p className="font-semibold">{run.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {run.task} · {run.agent} · {run.case_name}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge status={run.status as RunStatus} />
                  <span className="text-xs text-muted-foreground">
                    {new Date(run.created_at).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">No runs found.</p>
        )}
      </div>
    </main>
  );
}
