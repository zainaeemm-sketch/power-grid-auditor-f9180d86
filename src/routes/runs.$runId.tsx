import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Play } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/runs/$runId")({
  head: () => ({
    meta: [
      { title: "Run Details — GridArena" },
    ],
  }),
  component: RunDetailPage,
});

function RunDetailPage() {
  const { runId } = Route.useParams();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/runs">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Run #{runId}</h1>
            <StatusBadge status="queued" />
          </div>
          <p className="text-sm text-muted-foreground">Placeholder · Will load from database</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button size="sm">
            <Play className="mr-2 h-4 w-4" /> Run LLM
          </Button>
        </div>
      </div>

      {/* Panels grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/60">
          <CardHeader><CardTitle className="text-base">Experiment Metadata</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Provider, model, prompt version, dataset version, seed, notes…</p></CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardHeader><CardTitle className="text-base">Prompt & Response Log</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Editable prompt and response text areas…</p></CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardHeader><CardTitle className="text-base">Agent Recommendation</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Recommendation text will appear here…</p></CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardHeader><CardTitle className="text-base">Parser Provenance</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Parsed actions and parser notes…</p></CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardHeader><CardTitle className="text-base">Action Proposal</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Structured actions with enable/disable toggles…</p></CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardHeader><CardTitle className="text-base">Results Summary</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Feasibility, violations, confidence…</p></CardContent>
        </Card>
      </div>
    </main>
  );
}
