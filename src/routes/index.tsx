import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Play, List, FlaskConical, Layers, GitCompare } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GridArena — LLM Agent Research Platform" },
      { name: "description", content: "Evaluate and audit LLM agents on power-system tasks." },
    ],
  }),
  component: HomePage,
});

const overviewCards = [
  { icon: Play, label: "Experiment Runs", description: "Launch and monitor agent evaluation runs" },
  { icon: FlaskConical, label: "Presets", description: "Reusable experiment configurations" },
  { icon: Layers, label: "Batches", description: "Group runs for comparative analysis" },
  { icon: GitCompare, label: "Compare", description: "Side-by-side run comparison" },
];

function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      {/* Hero */}
      <section className="mb-16 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <Zap className="h-4 w-4" />
          Research Platform
        </div>
        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
          GridArena
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
          Evaluate, compare, and audit LLM agents on power-system tasks.
          Run experiments with full provenance tracking, structured action parsing,
          and automated evaluation.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link to="/new-run">
              <Play className="mr-2 h-4 w-4" />
              Start New Run
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/runs">
              <List className="mr-2 h-4 w-4" />
              View Runs
            </Link>
          </Button>
        </div>
      </section>

      {/* Overview cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {overviewCards.map(({ icon: Icon, label, description }) => (
          <Card key={label} className="border-border/60 bg-card/60">
            <CardContent className="flex flex-col items-start gap-3 p-5">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">{label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
