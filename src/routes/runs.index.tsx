import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, Plus } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/runs")({
  head: () => ({
    meta: [
      { title: "Runs — GridArena" },
      { name: "description", content: "Browse and search experiment runs." },
    ],
  }),
  component: RunsPage,
});

type RunStatus = "queued" | "running" | "completed";

interface RunItem {
  id: string;
  title: string;
  task: string;
  agent: string;
  case_name: string;
  status: RunStatus;
  created_at: string;
}

const sampleRuns: RunItem[] = [
  { id: "1", title: "Load Scaling Test - IEEE 14", task: "load_scaling", agent: "gpt-4o", case_name: "ieee14", status: "completed", created_at: "2026-04-15T10:30:00Z" },
  { id: "2", title: "Generator Dispatch - IEEE 39", task: "dispatch", agent: "claude-3.5", case_name: "ieee39", status: "running", created_at: "2026-04-15T14:00:00Z" },
  { id: "3", title: "Line Outage Recovery", task: "contingency", agent: "gpt-4o", case_name: "ieee118", status: "queued", created_at: "2026-04-16T08:00:00Z" },
];

function RunsPage() {
  const [search, setSearch] = useState("");
  const filtered = sampleRuns.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.agent.toLowerCase().includes(search.toLowerCase()) ||
      r.task.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Experiment Runs</h1>
        <Button asChild>
          <Link to="/new-run">
            <Plus className="mr-2 h-4 w-4" />
            New Run
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search runs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Run list */}
      <div className="space-y-3">
        {filtered.map((run) => (
          <Link key={run.id} to="/runs/$runId" params={{ runId: run.id }} className="block">
            <Card className="border-border/60 bg-card/60 transition-colors hover:border-primary/40">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex flex-col gap-1">
                  <p className="font-semibold">{run.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {run.task} · {run.agent} · {run.case_name}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge status={run.status} />
                  <span className="text-xs text-muted-foreground">
                    {new Date(run.created_at).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">No runs found.</p>
        )}
      </div>
    </main>
  );
}
