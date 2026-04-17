import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/docs/workflow")({
  head: () => ({
    meta: [
      { title: "Experiment Workflow — GridArena Docs" },
      { name: "description", content: "End-to-end lifecycle of a GridArena experiment: prompt, LLM call, parsing, simulation, evaluation, persistence." },
      { property: "og:title", content: "Experiment Workflow — GridArena Docs" },
      { property: "og:description", content: "End-to-end lifecycle of a GridArena experiment from prompt to evaluation." },
    ],
  }),
  component: WorkflowPage,
});

function WorkflowPage() {
  return (
    <>
      <h1>Experiment Workflow</h1>
      <p>
        Every GridArena run follows the same deterministic pipeline. Each stage is logged
        and inspectable from the run detail page so experiments are fully reproducible.
      </p>

      <h2>1. Configuration</h2>
      <p>
        A run starts from either a manual form (<code>/new-run</code>) or a preset. The configuration
        captures the benchmark case, model, sampling parameters (temperature, top_p, seed), the
        prompt template, and the evaluation mode (rule-based or simulation-based).
      </p>

      <h2>2. Enqueue</h2>
      <p>
        For batch executions, one <code>run_execution</code> job is enqueued per pending run. The
        job queue (Postgres-backed, lease + retry) ensures durability across worker restarts.
        Single runs execute synchronously through the same code path.
      </p>

      <h2>3. LLM call</h2>
      <p>
        The Edge Worker calls the configured LLM via the Lovable AI Gateway with the rendered
        prompt. A deterministic <code>random_seed</code> and fixed sampling parameters make the
        same input reproduce the same output (within provider tolerances).
      </p>

      <h2>4. Parsing</h2>
      <p>
        The raw response is parsed into a structured action ({" "}
        <code>scale_all_loads</code>, <code>set_generator_p_mw</code>, <code>line_outage</code>) plus a
        target index and value. The parser version is recorded so logic changes are auditable.
      </p>

      <h2>5. Simulation &amp; Evaluation</h2>
      <p>
        The action is applied to a fresh copy of the benchmark case. In simulation mode, GridArena
        calls the external pandapower service (full AC powerflow) or falls back to the bundled
        deterministic DC solver. Baseline and post-action violations are counted, feasibility is
        assessed, and the engine used is recorded on the evaluation row.
      </p>

      <h2>6. Persistence</h2>
      <p>
        Every artifact is stored: <code>runs</code>, <code>run_metadata</code>,{" "}
        <code>run_prompt_logs</code>, <code>run_parse_results</code>,{" "}
        <code>run_recommendations</code>, <code>run_evaluations</code>. RLS scopes everything to
        the authenticated user. Batches link to runs through <code>batch_run_links</code>.
      </p>

      <h2>7. Reporting</h2>
      <p>
        Run and batch reports render the full provenance tree, evaluation summary, and structured
        action. Exports (CSV / LaTeX / SVG) are one click away from any report view.
      </p>
    </>
  );
}
