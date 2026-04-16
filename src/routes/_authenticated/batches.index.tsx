import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Layers } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { listBatches } from "@/server/batch.functions";
import type { Batch, RunStatus } from "@/types/grid-arena";

export const Route = createFileRoute("/_authenticated/batches/")({
  head: () => ({
    meta: [
      { title: "Batches — GridArena" },
      { name: "description", content: "Manage batch experiments." },
    ],
  }),
  loader: async () => {
    if (typeof window === "undefined") return { batches: [] };
    try {
      return await listBatches();
    } catch {
      return { batches: [] };
    }
  },
  component: BatchesPage,
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

function BatchesPage() {
  const { batches } = Route.useLoaderData() as { batches: Array<Batch & { run_count: number }> };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Batch Experiments</h1>
        <Button asChild>
          <Link to="/batches/new">
            <Plus className="mr-2 h-4 w-4" />
            New Batch
          </Link>
        </Button>
      </div>

      {batches.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No batches yet. Create one to get started.</p>
      ) : (
        <div className="space-y-3">
          {batches.map((batch) => (
            <Link key={batch.id} to="/batches/$batchId" params={{ batchId: batch.id }} className="block">
              <Card className="border-border/60 bg-card/60 transition-colors hover:border-primary/40">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex flex-col gap-1">
                    <p className="flex items-center gap-2 font-semibold">
                      <Layers className="h-4 w-4 text-primary" />
                      {batch.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {batch.task} · {batch.run_count} runs
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={batch.status as RunStatus} />
                    <span className="text-xs text-muted-foreground">
                      {new Date(batch.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
