import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, Target, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listRuns, deleteRun, updateRun, type RunListItem } from "@/server/runs.functions";
import { useSoftDelete } from "@/hooks/useSoftDelete";
import { BulkActionBar } from "@/components/BulkActionBar";
import type { RunStatus } from "@/types/grid-arena";

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
const GT_ALL = "all";
const GT_ONLY = "linked";
const GT_NONE = "none";

const CC_ALL = "all";
const CC_DISPUTED = "disputed";
const CC_CONFIRMED = "confirmed";
const CC_BOTH_REJECT = "both_reject";
const CC_SIM_ONLY = "simulator_only";
const CC_JUDGE_ONLY = "judge_only";
const CC_NO_JUDGE = "no_judgment";

function deriveCrossCheck(feasibility: string | null, verdict: string | null): string | null {
  if (!feasibility || !verdict) return null;
  const feasible = feasibility === "feasible";
  const agree = verdict === "agree";
  if (feasible && agree) return "confirmed";
  if (feasible && !agree) return "simulator_only";
  if (!feasible && agree) return "judge_only";
  return "both_reject";
}

function actionMatchVariant(m: string | null | undefined) {
  if (m === "exact") return "default" as const;
  if (m === "partial") return "secondary" as const;
  return "outline" as const;
}

function formatGap(gap: number | null | undefined) {
  if (gap == null || !Number.isFinite(gap)) return "—";
  const sign = gap > 0 ? "+" : "";
  return `${sign}${gap.toFixed(2)}`;
}

function RunsPage() {
  const { runs, error } = Route.useLoaderData() as { runs: RunListItem[]; error: string | null };
  const router = useRouter();
  const deleteRunFn = useServerFn(deleteRun);
  const updateRunFn = useServerFn(updateRun);
  const { pendingIds, softDelete, softDeleteMany } = useSoftDelete();
  const [search, setSearch] = useState("");
  const [taskFilter, setTaskFilter] = useState(ALL);
  const [agentFilter, setAgentFilter] = useState(ALL);
  const [caseFilter, setCaseFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [gtFilter, setGtFilter] = useState(GT_ALL);
  const [ccFilter, setCcFilter] = useState(CC_ALL);
  const [sortBy, setSortBy] = useState("recent");
  const [deleteTarget, setDeleteTarget] = useState<RunListItem | null>(null);
  const [editTarget, setEditTarget] = useState<RunListItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const clearSelection = () => setSelected(new Set());

  const handleDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    softDelete(
      target.id,
      target.title,
      () => deleteRunFn({ data: { run_id: target.id } }),
      () => router.invalidate(),
    );
  };

  const handleBulkDelete = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkConfirmOpen(false);
    clearSelection();
    softDeleteMany(
      ids,
      `${ids.length} ${ids.length === 1 ? "run" : "runs"}`,
      (id) => deleteRunFn({ data: { run_id: id } }),
      () => router.invalidate(),
    );
  };

  const handleEditSave = () => {
    if (!editTarget) return;
    setBusy(true);
    updateRunFn({ data: { run_id: editTarget.id, title: editTitle } })
      .then(() => {
        toast.success("Run updated");
        setEditTarget(null);
        return router.invalidate();
      })
      .catch((e: any) => toast.error(e?.message || "Failed to update run"))
      .finally(() => setBusy(false));
  };

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

  const matchRank: Record<string, number> = { exact: 3, partial: 2, none: 1 };

  const filtered = useMemo(() => {
    const base = runs.filter((r) => {
      if (pendingIds.has(r.id)) return false;
      if (taskFilter !== ALL && r.task !== taskFilter) return false;
      if (agentFilter !== ALL && r.agent !== agentFilter) return false;
      if (caseFilter !== ALL && r.case_name !== caseFilter) return false;
      if (statusFilter !== ALL && r.status !== statusFilter) return false;
      const hasGt = Boolean(r.ground_truth_scenario_id) || r.evaluation_against_ground_truth === true;
      if (gtFilter === GT_ONLY && !hasGt) return false;
      if (gtFilter === GT_NONE && hasGt) return false;
      if (ccFilter !== CC_ALL) {
        const cc = deriveCrossCheck(r.feasibility, r.judge_verdict);
        if (ccFilter === CC_NO_JUDGE) {
          if (cc !== null) return false;
        } else if (ccFilter === CC_DISPUTED) {
          if (cc !== "simulator_only" && cc !== "judge_only") return false;
        } else if (cc !== ccFilter) {
          return false;
        }
      }
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

    const gapVal = (r: RunListItem) =>
      r.optimality_gap == null || !Number.isFinite(r.optimality_gap) ? null : Number(r.optimality_gap);
    const matchVal = (r: RunListItem) => (r.action_match ? matchRank[r.action_match] ?? 0 : 0);

    const sorted = [...base];
    switch (sortBy) {
      case "gap_asc": // best first (smallest / most negative gap = agent matched or beat reference)
        sorted.sort((a, b) => {
          const av = gapVal(a), bv = gapVal(b);
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return av - bv;
        });
        break;
      case "gap_desc": // worst first (largest positive gap)
        sorted.sort((a, b) => {
          const av = gapVal(a), bv = gapVal(b);
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return bv - av;
        });
        break;
      case "match_desc": // best match quality first
        sorted.sort((a, b) => matchVal(b) - matchVal(a));
        break;
      case "match_asc":
        sorted.sort((a, b) => matchVal(a) - matchVal(b));
        break;
      default:
        sorted.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
    }
    return sorted;
  }, [runs, pendingIds, taskFilter, agentFilter, caseFilter, statusFilter, gtFilter, ccFilter, search, sortBy]);

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
        <Select value={gtFilter} onValueChange={setGtFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Ground truth" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GT_ALL}>All runs</SelectItem>
            <SelectItem value={GT_ONLY}>With ground truth</SelectItem>
            <SelectItem value={GT_NONE}>Without ground truth</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most recent</SelectItem>
            <SelectItem value="gap_asc">Optimality gap (best first)</SelectItem>
            <SelectItem value="gap_desc">Optimality gap (worst first)</SelectItem>
            <SelectItem value="match_desc">Action match (best first)</SelectItem>
            <SelectItem value="match_asc">Action match (worst first)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length > 0 && (
        <div className="mb-2 flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <Checkbox
            checked={
              selected.size > 0 && filtered.every((r) => selected.has(r.id))
                ? true
                : selected.size > 0
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(v) => {
              if (v) setSelected(new Set(filtered.map((r) => r.id)));
              else clearSelection();
            }}
            aria-label="Select all filtered runs"
          />
          <span>Select all ({filtered.length})</span>
        </div>
      )}

      <div className="space-y-3 pb-24">
        {filtered.map((run) => {
          const hasGt = Boolean(run.ground_truth_scenario_id) || run.evaluation_against_ground_truth === true;
          const isSelected = selected.has(run.id);
          return (
            <Card key={run.id} className={`gradient-border-left border-border/40 bg-card/60 hover-lift card-glow hover:border-primary/30 ${isSelected ? "ring-1 ring-primary/60" : ""}`}>
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleOne(run.id)}
                    aria-label={`Select ${run.title}`}
                  />
                  <Link to="/runs/$runId" params={{ runId: run.id }} className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="truncate font-semibold">{run.title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {run.task} · {run.agent} · {run.case_name}
                    </p>
                  </Link>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {hasGt && (
                    <div className="flex items-center gap-2 text-xs">
                      <Target className="h-3.5 w-3.5 text-muted-foreground" />
                      <Badge variant={actionMatchVariant(run.action_match)} className="capitalize">
                        {run.action_match ?? "no match"}
                      </Badge>
                      <span className="tabular-nums text-muted-foreground">
                        gap {formatGap(run.optimality_gap)}
                      </span>
                    </div>
                  )}
                  <StatusBadge status={run.status as RunStatus} />
                  <span className="text-xs text-muted-foreground">
                    {new Date(run.created_at).toLocaleDateString()}
                  </span>
                  <Button
                    variant="ghost" size="icon" title="Edit title"
                    onClick={() => { setEditTarget(run); setEditTitle(run.title); }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" title="Delete run"
                    onClick={() => setDeleteTarget(run)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">No runs found.</p>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this run?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" will be removed. You'll have 5 seconds to undo before it and all related decision traces, metadata, evaluations, and recommendations are permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit run title</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={busy}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={busy || !editTitle.trim()}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} {selected.size === 1 ? "run" : "runs"}?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll have 5 seconds to undo. After that, the selected runs and all their traces, metadata, evaluations, and recommendations will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BulkActionBar
        count={selected.size}
        itemLabel="run"
        onDelete={() => setBulkConfirmOpen(true)}
        onClear={clearSelection}
      />
    </main>
  );
}
