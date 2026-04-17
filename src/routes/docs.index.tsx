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

      <h2>Citation</h2>
      <p>
        If you use GridArena in your research, please cite it. See the <Link to="/about">About</Link> page for
        APA and BibTeX entries.
      </p>
    </>
  );
}
