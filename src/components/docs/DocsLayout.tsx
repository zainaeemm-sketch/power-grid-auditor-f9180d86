import { Link, Outlet } from "@tanstack/react-router";
import {
  BookOpen,
  Download,
  PlayCircle,
  Workflow,
  Network,
  Repeat,
  LifeBuoy,
} from "lucide-react";

const docsNav = [
  { to: "/docs" as const, label: "Overview", icon: BookOpen, exact: true },
  { to: "/docs/installation" as const, label: "Installation", icon: Download, exact: false },
  { to: "/docs/usage" as const, label: "Usage", icon: PlayCircle, exact: false },
  { to: "/docs/workflow" as const, label: "Experiment Workflow", icon: Workflow, exact: false },
  { to: "/docs/architecture" as const, label: "Architecture", icon: Network, exact: false },
  { to: "/docs/reproducibility" as const, label: "Reproducibility", icon: Repeat, exact: false },
  { to: "/docs/troubleshooting" as const, label: "Troubleshooting", icon: LifeBuoy, exact: false },
];

export function DocsLayout() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Documentation
          </div>
          <nav className="flex flex-col gap-0.5">
            {docsNav.map(({ to, label, icon: Icon, exact }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact }}
                activeProps={{ className: "bg-primary/10 text-primary" }}
                inactiveProps={{ className: "text-muted-foreground hover:bg-muted hover:text-foreground" }}
                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0">
          <article className="prose prose-invert max-w-none [&_h1]:mb-4 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_p]:my-3 [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-muted-foreground [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:text-muted-foreground [&_li]:my-1 [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_strong]:text-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-mono">
            <Outlet />
          </article>
        </main>
      </div>
    </div>
  );
}
