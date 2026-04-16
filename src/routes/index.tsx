import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Play, List, FlaskConical, Layers, GitCompare, LogIn, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

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
  { icon: Play, label: "Experiment Runs", description: "Launch and monitor agent evaluation runs", accent: "from-primary to-[oklch(0.72_0.14_200)]", borderHover: "hover:border-primary/50" },
  { icon: FlaskConical, label: "Presets", description: "Reusable experiment configurations", accent: "from-[oklch(0.627_0.265_303.9)] to-[oklch(0.72_0.14_200)]", borderHover: "hover:border-[oklch(0.627_0.265_303.9)]/50" },
  { icon: Layers, label: "Batches", description: "Group runs for comparative analysis", accent: "from-[oklch(0.769_0.188_70.08)] to-primary", borderHover: "hover:border-[oklch(0.769_0.188_70.08)]/50" },
  { icon: GitCompare, label: "Compare", description: "Side-by-side run comparison", accent: "from-[oklch(0.72_0.14_200)] to-primary", borderHover: "hover:border-[oklch(0.72_0.14_200)]/50" },
];

function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <section className="hero-glow relative mb-16 text-center">
        <div
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-gradient-to-r from-primary/15 to-[oklch(0.72_0.14_200)]/15 px-4 py-1.5 text-sm font-semibold text-primary animate-fade-up"
          style={{ animationDelay: "0ms" }}
        >
          <Zap className="h-4 w-4" />
          Research Platform
        </div>
        <h1
          className="mb-2 text-4xl font-extrabold tracking-tight sm:text-6xl animate-fade-up"
          style={{ animationDelay: "100ms" }}
        >
          <span className="text-foreground">Grid</span>
          <span className="gradient-text">Arena</span>
        </h1>
        <div
          className="mx-auto mb-6 h-1 w-20 rounded-full bg-gradient-to-r from-primary to-[oklch(0.72_0.14_200)] animate-fade-up"
          style={{ animationDelay: "200ms" }}
        />
        <p
          className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground animate-fade-up"
          style={{ animationDelay: "250ms" }}
        >
          Evaluate, compare, and audit LLM agents on power-system tasks.
          Run experiments with full provenance tracking, structured action parsing,
          and automated evaluation.
        </p>
        <div
          className="flex items-center justify-center gap-4 animate-fade-up"
          style={{ animationDelay: "350ms" }}
        >
          {isAuthenticated ? (
            <>
              <Button asChild size="lg" className="bg-gradient-to-r from-primary to-[oklch(0.72_0.14_200)] text-primary-foreground font-semibold shadow-lg hover:shadow-[0_0_25px_oklch(0.696_0.17_162.48/0.3)] transition-shadow duration-300">
                <Link to="/new-run">
                  <Play className="mr-2 h-4 w-4" />
                  Start New Run
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-border/60 hover:border-primary/40 transition-colors duration-300">
                <Link to="/runs">
                  <List className="mr-2 h-4 w-4" />
                  View Runs
                </Link>
              </Button>
            </>
          ) : (
            <Button asChild size="lg" className="bg-gradient-to-r from-primary to-[oklch(0.72_0.14_200)] text-primary-foreground font-semibold shadow-lg hover:shadow-[0_0_25px_oklch(0.696_0.17_162.48/0.3)] transition-shadow duration-300">
              <Link to="/login">
                <LogIn className="mr-2 h-4 w-4" />
                Sign In to Get Started
              </Link>
            </Button>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {overviewCards.map(({ icon: Icon, label, description, accent, borderHover }, i) => (
          <Card
            key={label}
            className={`group border-border/40 bg-card/60 hover-lift card-glow ${borderHover} animate-fade-up`}
            style={{ animationDelay: `${450 + i * 100}ms` }}
          >
            <CardContent className="flex flex-col items-start gap-3 p-5">
              <div className={`rounded-lg bg-gradient-to-br ${accent} p-2.5`}>
                <Icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-bold">{label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </div>
              <span className="mt-auto flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                Explore <ArrowRight className="h-3 w-3" />
              </span>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
