import { createFileRoute } from "@tanstack/react-router";
import { CodeBlock } from "@/components/docs/CodeBlock";

export const Route = createFileRoute("/docs/installation")({
  head: () => ({
    meta: [
      { title: "Installation — GridArena Docs" },
      { name: "description", content: "How to install, configure, and deploy GridArena, including the optional pandapower simulation service." },
      { property: "og:title", content: "Installation — GridArena Docs" },
      { property: "og:description", content: "Install, configure, and deploy GridArena including the pandapower simulation service." },
    ],
  }),
  component: InstallationPage,
});

function InstallationPage() {
  return (
    <>
      <h1>Installation</h1>
      <p>
        GridArena ships as a single TanStack Start application backed by Lovable Cloud
        (Postgres + Auth + Edge Functions). The optional pandapower simulation service runs
        as a separate FastAPI container.
      </p>

      <h2>1. Prerequisites</h2>
      <ul>
        <li>Node.js ≥ 20 and <code>bun</code> (or <code>npm</code>) for local development.</li>
        <li>A Lovable account — Cloud is provisioned automatically when you fork this project.</li>
        <li>(Optional) Docker for the pandapower simulation container.</li>
      </ul>

      <h2>2. Local development</h2>
      <CodeBlock language="bash">{`bun install
bun run dev`}</CodeBlock>
      <p>
        The app starts at <code>http://localhost:3000</code>. Database, auth, and the LLM gateway are
        wired automatically through Lovable Cloud — no <code>.env</code> editing required.
      </p>

      <h2>3. Deploying the simulation service (optional)</h2>
      <p>
        If you want physics-accurate evaluation via pandapower, deploy the
        FastAPI container under <code>simulation-service/</code> to any host
        that exposes an HTTPS URL (e.g. Fly.io, Railway, Render).
      </p>
      <CodeBlock language="bash">{`cd simulation-service
docker build -t gridarena-sim .
docker run -p 8000:8000 gridarena-sim`}</CodeBlock>

      <h2>4. Configuration secrets</h2>
      <p>
        Two secrets are managed inside Lovable Cloud — set them once in the platform's
        Connectors panel:
      </p>
      <ul>
        <li><code>SIMULATION_SERVICE_URL</code> — the deployed simulation service URL (optional; falls back to the in-Worker DC solver).</li>
        <li><code>SIMULATION_SERVICE_TOKEN</code> — bearer token used to authenticate to the simulation service.</li>
      </ul>
      <p>
        When neither is configured, GridArena automatically uses the deterministic DC
        powerflow solver bundled in the Edge Worker.
      </p>

      <h2>5. Verifying the install</h2>
      <ul>
        <li>Sign in, then visit <code>/system-status</code> — the queue should report 0 active jobs.</li>
        <li>Visit <code>/health</code> — engines and providers should report green.</li>
        <li>Run the validation suite from <code>/validation</code> — all categories should pass.</li>
      </ul>
    </>
  );
}
