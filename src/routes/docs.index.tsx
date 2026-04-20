import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/docs/")({
  head: () => ({
    meta: [
      { title: "Overview — GridArena Docs" },
      { name: "description", content: "Overview of GridArena, an LLM agent research platform for power system operations." },
      { property: "og:title", content: "Overview — GridArena Docs" },
      { property: "og:description", content: "Overview of GridArena, an LLM agent research platform for power system operations." },
    ],
  }),
  component: DocsOverview,
});

function DocsOverview() {
  return (
    <>
      <h1>GridArena Documentation</h1>
      <p>
        <strong>GridArena</strong> is a research platform for evaluating and auditing LLM agents on
        power-system operational tasks. It combines deterministic simulation, structured evaluation,
        and full provenance logging so experiments are reproducible end-to-end.
      </p>

      <h2>What you can do</h2>
      <ul>
        <li>Run a single LLM agent on a benchmark case (case5 / case14 / case30) and inspect every step.</li>
        <li>Compose presets and execute large batch experiments with background queueing.</li>
        <li>Evaluate recommendations against a deterministic DC powerflow solver (or external pandapower service).</li>
        <li>Compare runs side-by-side, export results to CSV / LaTeX / SVG, and validate the system itself.</li>
      </ul>

      <h2>Where to start</h2>
      <ul>
        <li><Link to="/docs/installation">Installation</Link> — how the platform is wired and what to configure.</li>
        <li><Link to="/docs/usage">Usage</Link> — sign in, create runs, manage presets and batches.</li>
        <li><Link to="/docs/workflow">Experiment Workflow</Link> — the full lifecycle from prompt to evaluation.</li>
        <li><Link to="/docs/architecture">Architecture</Link> — system diagram and component responsibilities.</li>
        <li><Link to="/docs/reproducibility">Reproducibility</Link> — three reproducible experiments with expected metrics.</li>
        <li><Link to="/docs/troubleshooting">Troubleshooting</Link> — common errors and fixes.</li>
      </ul>

      <div className="my-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
        <h3 className="!mt-0 text-base font-semibold text-foreground">New: Counterfactual Analysis (Layer E)</h3>
        <p className="!mb-2">
          GridArena now replays each agent decision against alternative actions to compute
          <strong> optimality gap</strong> and <strong>decision regret</strong>.
        </p>
        <ul className="!my-0">
          <li><Link to="/docs/workflow" hash="counterfactual-analysis-layer-e">Workflow → Counterfactual analysis</Link> — formulas and methodology.</li>
          <li><Link to="/docs/architecture" hash="counterfactual-engine-layer-e">Architecture → Counterfactual Engine</Link> — where it sits in the pipeline.</li>
        </ul>
      </div>

      <h2>Citation</h2>
      <p>
        If you use GridArena in your research, please cite it. See the <Link to="/about">About</Link> page for
        APA and BibTeX entries.
      </p>
    </>
  );
}
