import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Layers, Pencil, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/StatusBadge";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { listBatches, deleteBatch, updateBatch } from "@/server/batch.functions";
import { useSoftDelete } from "@/hooks/useSoftDelete";
import { BulkActionBar } from "@/components/BulkActionBar";
import type { Batch, RunStatus } from "@/types/grid-arena";

export const Route = createFileRoute("/_authenticated/batches/")({
  head: () => ({
    meta: [
      { title: "Batches — GridArena" },
      { name: "description", content: "Manage batch experiments." },
    ],
  }),
  loader: async () => {
    if (typeof window === "undefined") return { batches: [] };
    try {
      return await listBatches();
    } catch {
      return { batches: [] };
    }
  },
  component: BatchesPage,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-destructive">Error: {error.message}</p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-muted-foreground">Not found.</p>
    </main>
  ),
});

type BatchRow = Batch & { run_count: number };

function BatchesPage() {
  const { batches } = Route.useLoaderData() as { batches: BatchRow[] };
  const router = useRouter();
  const deleteFn = useServerFn(deleteBatch);
  const updateFn = useServerFn(updateBatch);
  const { pendingIds, softDelete, softDeleteMany } = useSoftDelete();
  const [deleteTarget, setDeleteTarget] = useState<BatchRow | null>(null);
  const [editTarget, setEditTarget] = useState<BatchRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editRq, setEditRq] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const visibleBatches = batches.filter((b) => !pendingIds.has(b.id));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const clearSelection = () => setSelected(new Set());

  const handleBulkDelete = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkConfirmOpen(false);
    clearSelection();
    softDeleteMany(
      ids,
      `${ids.length} ${ids.length === 1 ? "batch" : "batches"}`,
      (id) => deleteFn({ data: { batch_id: id } }),
      () => router.invalidate(),
    );
  };

  const openEdit = (b: BatchRow) => {
    setEditTarget(b);
    setEditName(b.name);
    setEditRq(b.research_question ?? "");
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    softDelete(
      target.id,
      target.name,
      () => deleteFn({ data: { batch_id: target.id } }),
      () => router.invalidate(),
    );
  };

  const handleSave = async () => {
    if (!editTarget) return;
    setBusy(true);
    try {
      await updateFn({ data: { batch_id: editTarget.id, name: editName, research_question: editRq || null } });
      toast.success("Batch updated");
      setEditTarget(null);
      await router.invalidate();
    } catch (e: any) { toast.error(e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Batch Experiments</h1>
        <Button asChild>
          <Link to="/batches/new">
            <Plus className="mr-2 h-4 w-4" />
            New Batch
          </Link>
        </Button>
      </div>

      {batches.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No batches yet. Create one to get started.</p>
      ) : (
        <>
          {visibleBatches.length > 0 && (
            <div className="mb-2 flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <Checkbox
                checked={
                  selected.size > 0 && visibleBatches.every((b) => selected.has(b.id))
                    ? true
                    : selected.size > 0
                      ? "indeterminate"
                      : false
                }
                onCheckedChange={(v) => {
                  if (v) setSelected(new Set(visibleBatches.map((b) => b.id)));
                  else clearSelection();
                }}
                aria-label="Select all batches"
              />
              <span>Select all ({visibleBatches.length})</span>
            </div>
          )}
          <div className="space-y-3 pb-24">
            {visibleBatches.map((batch) => {
              const isSelected = selected.has(batch.id);
              return (
                <Card key={batch.id} className={`gradient-border-left border-border/40 bg-card/60 hover-lift card-glow hover:border-primary/30 ${isSelected ? "ring-1 ring-primary/60" : ""}`}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(batch.id)}
                        aria-label={`Select ${batch.name}`}
                      />
                      <Link to="/batches/$batchId" params={{ batchId: batch.id }} className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className="flex items-center gap-2 font-semibold">
                          <Layers className="h-4 w-4 gradient-text" />
                          {batch.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {batch.task} · {batch.run_count} runs
                        </p>
                      </Link>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={batch.status as RunStatus} />
                      <span className="text-xs text-muted-foreground">
                        {new Date(batch.created_at).toLocaleDateString()}
                      </span>
                      <Button variant="ghost" size="icon" title="Edit batch" onClick={() => openEdit(batch)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Delete batch" onClick={() => setDeleteTarget(batch)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this batch?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" will be removed. You'll have 5 seconds to undo before its run links are permanently deleted. The underlying runs will remain.
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
          <DialogHeader><DialogTitle>Edit batch</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Research question</Label>
              <Textarea value={editRq} onChange={(e) => setEditRq(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={busy}>Cancel</Button>
            <Button onClick={handleSave} disabled={busy || !editName.trim()}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} {selected.size === 1 ? "batch" : "batches"}?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll have 5 seconds to undo. After that, the selected batches and their run links will be permanently deleted. The underlying runs will remain.
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
        itemLabel="batch"
        onDelete={() => setBulkConfirmOpen(true)}
        onClear={clearSelection}
      />
    </main>
  );
}
