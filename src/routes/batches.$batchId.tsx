import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/batches/$batchId")({
  head: () => ({
    meta: [{ title: "Batch Details — GridArena" }],
  }),
  component: BatchDetailPage,
});

function BatchDetailPage() {
  const { batchId } = Route.useParams();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/batches"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-bold">Batch #{batchId}</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/60">
          <CardHeader><CardTitle className="text-base">Batch Analytics</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Charts and summary statistics will appear here…</p></CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardHeader><CardTitle className="text-base">Linked Runs</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">List of runs in this batch…</p></CardContent>
        </Card>
      </div>
    </main>
  );
}
