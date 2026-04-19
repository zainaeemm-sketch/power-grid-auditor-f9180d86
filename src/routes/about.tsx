import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, BookOpen, Github, ExternalLink } from "lucide-react";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ArchitectureDiagram } from "@/components/docs/ArchitectureDiagram";
import { CITATION, citationApa, citationBibtex } from "@/lib/citation";
import { seedDemoData } from "@/server/demo.functions";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — GridArena" },
      { name: "description", content: "GridArena is an open research platform for evaluating LLM agents on power-system operational tasks. Authors, affiliation, and citation information." },
      { property: "og:title", content: "About — GridArena" },
      { property: "og:description", content: "Open research platform for evaluating LLM agents on power-system operational tasks." },
      { name: "twitter:title", content: "About — GridArena" },
      { name: "twitter:description", content: "Open research platform for evaluating LLM agents on power-system operational tasks." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const { isAuthenticated } = useAuth();
  const [busy, setBusy] = useState(false);

  const seed = useMutation({
    mutationFn: () => seedDemoData(),
    onMutate: () => setBusy(true),
    onSuccess: (r) => toast.success("Demo dataset loaded", {
      description: `${r.presets_created} preset(s), ${r.runs_created} run(s).`,
      action: { label: "View Runs", onClick: () => { window.location.href = "/runs"; } },
    }),
    onError: (e: Error) => toast.error("Failed", { description: e.message }),
    onSettled: () => setBusy(false),
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <header className="mb-10">
        <h1 className="text-4xl font-bold text-foreground">About GridArena</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          An open research platform for evaluating and auditing LLM agents on
          power-system operational tasks.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-xl font-semibold text-foreground">Purpose</h2>
        <p className="text-muted-foreground leading-relaxed">
          GridArena lets researchers ask the question:{" "}
          <em>can an LLM agent recommend safe, effective corrective actions on a real power
          network?</em> It pairs deterministic benchmark cases with structured evaluation,
          full provenance logging, and reproducible execution — so claims about agent
          performance can be independently verified.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-xl font-semibold text-foreground">What's included</h2>
        <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
          <li>Deterministic benchmark cases (case5 / case14 / case30) with full provenance logging.</li>
          <li>Single-run and batch experiment execution with a durable Postgres-backed job queue.</li>
          <li>Rule-based and simulation-based evaluation (external pandapower service + DC fallback).</li>
          <li>Side-by-side comparison and one-click CSV / LaTeX / SVG export of any report.</li>
          <li>
            <strong className="text-foreground">Dashboard management:</strong> inline edit and
            delete on every list, soft-delete with a 5-second <em>Undo</em> toast, and bulk
            multi-select with a sticky action bar on Runs, Presets, and Batches.
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-xl font-semibold text-foreground">System at a glance</h2>
        <div className="rounded-lg border border-border bg-card p-4">
          <ArchitectureDiagram />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Full component breakdown in the <Link to="/docs/architecture" className="text-primary underline-offset-4 hover:underline">architecture docs</Link>.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-xl font-semibold text-foreground">Authors &amp; affiliation</h2>
        <p className="text-muted-foreground">
          <strong className="text-foreground">{CITATION.authors.join(", ")}</strong>
          <br />
          {CITATION.affiliation}
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-xl font-semibold text-foreground">How to cite</h2>
        <p className="text-muted-foreground">If you use GridArena in your research, please cite:</p>

        <h3 className="mt-5 mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">APA</h3>
        <CodeBlock language="text">{citationApa()}</CodeBlock>

        <h3 className="mt-5 mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">BibTeX</h3>
        <CodeBlock language="bibtex">{citationBibtex()}</CodeBlock>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-xl font-semibold text-foreground">Get started</h2>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="default">
            <Link to="/docs"><BookOpen className="mr-2 h-4 w-4" />Read the docs</Link>
          </Button>
          {isAuthenticated ? (
            <Button onClick={() => seed.mutate()} disabled={busy} variant="outline">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Load Demo Dataset
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link to="/login">Sign in to try it</Link>
            </Button>
          )}
          <Button asChild variant="ghost">
            <a href={CITATION.url} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />Live deployment
            </a>
          </Button>
        </div>
      </section>

    </main>
  );
}
