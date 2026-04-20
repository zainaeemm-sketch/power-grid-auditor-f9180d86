import { createFileRoute } from "@tanstack/react-router";
import { MethodologyDiagram } from "@/components/docs/MethodologyDiagram";

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

      <h2>Methodology at a glance</h2>
      <p>
        The diagram below summarises the end-to-end methodology: a benchmark case (optionally
        perturbed) and a templated prompt feed a seeded LLM agent, whose structured action is
        validated, simulated, and rule-evaluated in parallel before metrics and full provenance
        are persisted.
      </p>
      <div className="my-6 rounded-lg border border-border bg-card p-6">
        <MethodologyDiagram />
      </div>

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

      <h2>8. Counterfactual analysis (Layer E)</h2>
      <p>
        After a run completes, GridArena can replay the same benchmark case against a set of
        <em> alternative actions</em> — either contextual <strong>defaults</strong> (derived from
        the agent's chosen action type) or user-supplied <strong>custom</strong> actions. Each
        counterfactual is executed through the bundled deterministic DC power flow so results are
        reproducible and independent of the LLM call. Per-action outcomes are stored in{" "}
        <code>counterfactual_actions</code> and <code>counterfactual_results</code>, and surfaced
        in the run detail <strong>Counterfactual</strong> panel and the batch{" "}
        <strong>Counterfactual</strong> aggregation card.
      </p>

      <h3>What gets computed</h3>
      <p>
        For each counterfactual action <code>c</code> evaluated against the same case as the
        baseline agent action <code>a</code>, GridArena computes baseline and counterfactual
        feasibility, post-action violations, and violation improvement, then derives two headline
        metrics:
      </p>

      <h3>Optimality gap</h3>
      <p>
        The optimality gap measures how much <em>better</em> a counterfactual action would have
        been than the agent's chosen action, in terms of violations resolved:
      </p>
      <p>
        <code>optimality_gap(c) = max(0, improvement(c) − improvement(a))</code>
      </p>
      <p>
        where <code>improvement(x) = baseline_violations − post_action_violations(x)</code>. A
        value of <code>0</code> means the agent's action was at least as good as the
        counterfactual; a positive value quantifies the missed improvement (in violation count).
        The gap is clamped at zero so worse counterfactuals do not produce negative scores —
        they simply contribute <code>0</code>, since the agent already dominated them.
      </p>

      <h3>Decision regret</h3>
      <p>
        For a single counterfactual, decision regret mirrors the optimality gap:
      </p>
      <p>
        <code>decision_regret(c) = optimality_gap(c)</code>
      </p>
      <p>
        At the <strong>batch</strong> level it is aggregated as the mean regret across every
        successful counterfactual across every run:
      </p>
      <p>
        <code>
          avg_decision_regret = mean&#123; optimality_gap(c) : c ∈ successful counterfactuals &#125;
        </code>
      </p>
      <p>
        Intuitively, average decision regret answers: <em>"On average, how many additional
        violations could the agent have resolved if it had picked the best alternative we
        considered?"</em> Lower is better; <code>0</code> means the agent matched or beat every
        counterfactual we tested.
      </p>

      <h3>Feasibility change</h3>
      <p>
        Alongside the numeric metrics, each counterfactual is labelled with a categorical
        <code> feasibility_change</code>:
      </p>
      <ul>
        <li><strong>improved</strong> — counterfactual is feasible while baseline was not.</li>
        <li><strong>worsened</strong> — baseline was feasible but the counterfactual is not.</li>
        <li><strong>unchanged</strong> — both are feasible, both infeasible, or both partial.</li>
      </ul>

      <h3>Caveats</h3>
      <ul>
        <li>
          Counterfactuals run on the in-Worker DC power flow, which currently supports{" "}
          <code>case5</code>, <code>case14</code>, and <code>case30</code>. Larger cases (e.g.{" "}
          <code>ieee39</code>) report a <code>failure</code> status with a clear reason and are
          excluded from aggregates.
        </li>
        <li>
          Optimality gap and regret only consider the counterfactuals you executed — they are a
          lower bound on the true optimal-policy gap, not a global optimum.
        </li>
        <li>
          Failed counterfactuals (non-converged, unsupported case) are persisted with{" "}
          <code>status = "failure"</code> and <code>failure_reason</code> for full auditability,
          but do not contribute to averages.
        </li>
      </ul>

      <h2>9. Curating your dashboards</h2>
      <p>
        Once experiments accumulate, the Runs, Presets, Batches, Ground Truth, and Validation
        pages all support inline <strong>Edit</strong> and <strong>Delete</strong> actions.
        Deletes are <strong>soft</strong>: a 5-second toast with <em>Undo</em> lets you recover
        accidental removals before the row is permanently dropped. Runs, Presets, and Batches also
        offer <strong>bulk multi-select</strong> via row checkboxes and a sticky action bar — handy
        for cleaning up exploratory sweeps before publishing a report.
      </p>
    </>
  );
}
