import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { listRuns } from "@/server/runs.functions";
import type { Run, RunStatus } from "@/types/grid-arena";

export const Route = createFileRoute("/_authenticated/runs/")({
  head: () => ({
    meta: [
      { title: "Runs — GridArena" },
      { name: "description", content: "Browse and search experiment runs." },
    ],
  }),
  loader: async () => {
    if (typeof window === "undefined") return { runs: [], error: null };
    try {
      const result = await listRuns();
      return { ...result, error: null };
    } catch (err: any) {
      return { runs: [], error: err.message ?? "Failed to load runs" };
    }
  },
  component: RunsPage,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
        <p className="text-destructive font-medium">Failed to load runs</p>
        <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
      </div>
    </main>
  ),
});

const ALL = "__all__";

function RunsPage() {
  const { runs, error } = Route.useLoaderData() as { runs: Run[]; error: string | null };
  const [search, setSearch] = useState("");
  const [taskFilter, setTaskFilter] = useState(ALL);
  const [agentFilter, setAgentFilter] = useState(ALL);
  const [caseFilter, setCaseFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);

  const options = useMemo(() => {
    const tasks = new Set<string>();
    const agents = new Set<string>();
    const cases = new Set<string>();
    const statuses = new Set<string>();
    for (const r of runs) {
      tasks.add(r.task);
      agents.add(r.agent);
      cases.add(r.case_name);
      statuses.add(r.status);
    }
    return {
      tasks: [...tasks].sort(),
      agents: [...agents].sort(),
      cases: [...cases].sort(),
      statuses: [...statuses].sort(),
    };
  }, [runs]);

  const filtered = runs.filter((r: Run) => {
    if (taskFilter !== ALL && r.task !== taskFilter) return false;
    if (agentFilter !== ALL && r.agent !== agentFilter) return false;
    if (caseFilter !== ALL && r.case_name !== caseFilter) return false;
    if (statusFilter !== ALL && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.title.toLowerCase().includes(q) ||
        r.agent.toLowerCase().includes(q) ||
        r.task.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
          <p className="text-destructive font-medium">Failed to load runs</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      )}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Experiment Runs</h1>
        <Button asChild>
          <Link to="/new-run">
            <Plus className="mr-2 h-4 w-4" />
            New Run
          </Link>
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search runs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={taskFilter} onValueChange={setTaskFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Task" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Tasks</SelectItem>
            {options.tasks.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Agents</SelectItem>
            {options.agents.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={caseFilter} onValueChange={setCaseFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Case" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Cases</SelectItem>
            {options.cases.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Statuses</SelectItem>
            {options.statuses.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filtered.map((run: Run) => (
          <Link key={run.id} to="/runs/$runId" params={{ runId: run.id }} className="block">
            <Card className="gradient-border-left border-border/40 bg-card/60 hover-lift card-glow hover:border-primary/30">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex flex-col gap-1">
                  <p className="font-semibold">{run.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {run.task} · {run.agent} · {run.case_name}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge status={run.status as RunStatus} />
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