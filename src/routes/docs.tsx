import { createFileRoute } from "@tanstack/react-router";
import { DocsLayout } from "@/components/docs/DocsLayout";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Documentation — GridArena" },
      { name: "description", content: "User documentation for GridArena: installation, usage, experiment workflow, architecture, reproducibility, and troubleshooting." },
      { property: "og:title", content: "Documentation — GridArena" },
      { property: "og:description", content: "Learn how to run, reproduce, and extend GridArena experiments." },
      { name: "twitter:title", content: "Documentation — GridArena" },
      { name: "twitter:description", content: "Learn how to run, reproduce, and extend GridArena experiments." },
    ],
  }),
  component: DocsLayout,
});
