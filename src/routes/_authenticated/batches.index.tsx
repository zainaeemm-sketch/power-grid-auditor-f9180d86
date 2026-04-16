import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Layers } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/batches/")({
  head: () => ({
    meta: [
      { title: "Batches — GridArena" },
      { name: "description", content: "Manage batch experiments." },
    ],
  }),
  component: BatchesPage,
});

const sampleBatches = [
  { id: "1", name: "IEEE 14-Bus Sweep", task: "load_scaling", research_question: "How do agents compare on load scaling?", created_at: "2026-04-14T09:00:00Z", run_count: 5 },
  { id: "2", name: "Contingency Analysis", task: "contingency", research_question: "Which agent handles line outages best?", created_at: "2026-04-15T12:00:00Z", run_count: 3 },
];

function BatchesPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Batch Experiments</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Batch
        </Button>
      </div>

      <div className="space-y-3">
        {sampleBatches.map((batch) => (
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
                <span className="text-xs text-muted-foreground">
                  {new Date(batch.created_at).toLocaleDateString()}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
