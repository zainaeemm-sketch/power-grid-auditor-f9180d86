import { createFileRoute } from "@tanstack/react-router";
import { ArchitectureDiagram } from "@/components/docs/ArchitectureDiagram";
import { ValidationFeedbackDiagram } from "@/components/docs/ValidationFeedbackDiagram";

export const Route = createFileRoute("/docs/architecture")({
  head: () => ({
    meta: [
      { title: "Architecture — GridArena Docs" },
      { name: "description", content: "GridArena system architecture: frontend, edge worker, Postgres, LLM gateway, PyPSA simulation service, counterfactual and perturbation engines, and the LLM-as-judge / decision-trace audit layer." },
      { property: "og:title", content: "Architecture — GridArena Docs" },
      { property: "og:description", content: "Frontend, edge worker, Postgres, LLM gateway, PyPSA simulator, counterfactual + perturbation engines, and LLM-as-judge audit." },
    ],
  }),
  component: ArchitecturePage,
});

function ArchitecturePage() {
  return (
    <>
      <h1>Architecture</h1>
      <p>
        GridArena is a thin browser UI on top of edge-deployed server functions, a Postgres
        database, an LLM gateway, an optional Python simulation service, and an{" "}
        <strong>evaluation layer</strong> (counterfactual replays, perturbation jobs, decision-
        trace recorder, and LLM-as-judge). Together these implement GridArena's role as an
        evaluation harness for LLM agents — see the{" "}
        <a href="/docs/landscape">LLM Tools Landscape</a> for how this differs from operational
        agents like Grid-Agent, GridMind, GAIA, or PowerDAG.
      </p>

      <div className="my-6 rounded-lg border border-border bg-card p-6">
        <ArchitectureDiagram />
      </div>

      <p className="text-sm text-muted-foreground">
        For the experimental flow these components implement, see the{" "}
        <a href="/docs/workflow">methodology diagram</a>.
      </p>

      <h2>Components</h2>

      <h3>Browser (TanStack Start)</h3>
      <p>
        React 19 SPA with SSR, served from the edge. Uses TanStack Router for type-safe routing,
        TanStack Query for caching, and shadcn/ui components on Tailwind v4 design tokens.
      </p>

      <h3>Edge Worker (Server Functions)</h3>
      <p>
        Stateless functions that handle authentication, validation, queue processing, parsing,
        and the deterministic in-Worker DC powerflow solver. Concurrency-capped with built-in
        retry and lease-based locking.
      </p>

      <h3>Postgres (Lovable Cloud)</h3>
      <p>
        Single source of truth for runs, evaluations, metadata, presets, batches, the durable job
        queue, and validation results. Every table is RLS-scoped to the authenticated user.
      </p>

      <h3>LLM Gateway</h3>
      <p>
        Unified provider for Gemini and GPT-5 models with a fixed seed for reproducibility. No
        third-party API keys required — the gateway is built into Lovable Cloud.
      </p>

      <h3>Simulation Service (optional)</h3>
      <p>
        FastAPI + <strong>PyPSA</strong> container hosted externally — pure Python with no native
        binaries, supporting IEEE <code>case5</code>, <code>case14</code>, and <code>case30</code>.
        Exposes a stable HTTP contract (<code>/version</code>, <code>/health</code>,{" "}
        <code>/simulate</code>) used by both the evaluator and the diagnostics layer. Falls back
        to the in-Worker DC solver when the service is unavailable, so evaluations never block.
      </p>

      <h3 id="simulation-health-admin">Simulation Health (admin)</h3>
      <p>
        An admin-only diagnostics layer at <code>/simulation-health</code> that probes the
        external engine end-to-end: it calls <code>/version</code> and <code>/health</code>, then
        runs <code>/simulate</code> in parallel against IEEE case5/14/30. Each probe is persisted
        to <code>simulation_health_checks</code> (RLS-scoped) so failures can be reviewed over
        time. The page surfaces a state-change alert banner when the engine flips from pass to
        fail and renders contextual troubleshooting tips derived from the exact failing endpoint
        response (missing <code>SIMULATION_SERVICE_URL</code> / <code>TOKEN</code>, DNS or
        connection errors, 401/403, 5xx, per-case timeouts). Access is gated server-side via the{" "}
        <code>has_role</code> RPC — non-admin users see an access-required notice.
      </p>

      <h3 id="counterfactual-engine-layer-e">Counterfactual Engine (Layer E)</h3>
      <p>
        A deterministic replay layer that re-executes the same benchmark case against alternative
        actions — either contextual <strong>defaults</strong> derived from the agent's action type
        or user-supplied <strong>custom</strong> actions. Runs entirely on the in-Worker DC power
        flow (no LLM calls), persists per-action outcomes to <code>counterfactual_actions</code> and{" "}
        <code>counterfactual_results</code>, and surfaces optimality gap and decision regret in the
        run and batch reports. See the{" "}
        <a href="/docs/workflow">workflow docs</a> for the formulas.
      </p>

      <h3 id="perturbation-engine">Perturbation Engine (robustness layer)</h3>
      <p>
        Where the counterfactual engine swaps the <em>action</em>, the perturbation engine swaps
        the <em>environment</em>. It re-runs the agent against systematically modified versions of
        the benchmark case — load scaled up or down, generators tripped, lines removed — and
        records whether the recommendation degrades gracefully, switches modes, or breaks. Jobs
        are enqueued from the batch detail page, executed through the same Edge-Worker pipeline as
        normal runs, and persisted to <code>perturbation_jobs</code> /{" "}
        <code>perturbation_results</code> for cross-run aggregation. This is GridArena's answer to
        the robustness gap left open by single-shot benchmarks like PFBench and ProOPF.
      </p>

      <h3 id="judge-and-trace">Decision-trace recorder &amp; LLM-as-judge</h3>
      <p>
        Every run emits a structured <strong>decision trace</strong>: the prompt log, the raw LLM
        response, the parser's per-field provenance (regex / JSON / fallback), each tool call with
        arguments and result, and the final structured action. A separate <strong>LLM-as-judge</strong>{" "}
        function scores the recommendation against domain rubrics (safety, feasibility,
        actionability) and persists the score, the rubric used, and the judge model. Together the
        trace and the judge let researchers attribute failures to a specific cause — wrong tool,
        misparsed solver output, or flawed final reasoning — rather than reporting a single
        opaque pass/fail.
      </p>

      <h3>Rule-based Fallback</h3>
      <p>
        A deterministic, dependency-free evaluator that always works. Used when both simulation
        engines are unavailable or when an experiment explicitly opts out of simulation.
      </p>
    </>
  );
}
