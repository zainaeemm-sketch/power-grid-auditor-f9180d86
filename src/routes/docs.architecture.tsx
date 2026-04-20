import { createFileRoute } from "@tanstack/react-router";
import { ArchitectureDiagram } from "@/components/docs/ArchitectureDiagram";

export const Route = createFileRoute("/docs/architecture")({
  head: () => ({
    meta: [
      { title: "Architecture — GridArena Docs" },
      { name: "description", content: "GridArena system architecture: frontend, edge worker, Postgres, LLM gateway, and pandapower simulation service." },
      { property: "og:title", content: "Architecture — GridArena Docs" },
      { property: "og:description", content: "Frontend, edge worker, Postgres, LLM gateway, and pandapower simulation service." },
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
        database, an LLM gateway, and an optional Python simulation service.
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
        FastAPI + pandapower container hosted externally. Provides full AC powerflow when a
        higher-fidelity engine is needed. Falls back to the in-Worker DC solver when the service
        is unavailable, so evaluations never block.
      </p>

      <h3>Counterfactual Engine (Layer E)</h3>
      <p>
        A deterministic replay layer that re-executes the same benchmark case against alternative
        actions — either contextual <strong>defaults</strong> derived from the agent's action type
        or user-supplied <strong>custom</strong> actions. Runs entirely on the in-Worker DC power
        flow (no LLM calls), persists per-action outcomes to <code>counterfactual_actions</code> and{" "}
        <code>counterfactual_results</code>, and surfaces optimality gap and decision regret in the
        run and batch reports. See the{" "}
        <a href="/docs/workflow">workflow docs</a> for the formulas.
      </p>

      <h3>Rule-based Fallback</h3>
      <p>
        A deterministic, dependency-free evaluator that always works. Used when both simulation
        engines are unavailable or when an experiment explicitly opts out of simulation.
      </p>
    </>
  );
}
