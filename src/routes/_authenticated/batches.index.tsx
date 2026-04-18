import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Layers, Pencil, Trash2 } from "lucide-react";
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
  const [deleteTarget, setDeleteTarget] = useState<BatchRow | null>(null);
  const [editTarget, setEditTarget] = useState<BatchRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editRq, setEditRq] = useState("");
  const [busy, setBusy] = useState(false);

  const openEdit = (b: BatchRow) => {
    setEditTarget(b);
    setEditName(b.name);
    setEditRq(b.research_question ?? "");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteFn({ data: { batch_id: deleteTarget.id } });
      toast.success("Batch deleted");
      setDeleteTarget(null);
      await router.invalidate();
    } catch (e: any) { toast.error(e?.message || "Failed"); }
    finally { setBusy(false); }
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
        <div className="space-y-3">
          {batches.map((batch) => (
            <Card key={batch.id} className="gradient-border-left border-border/40 bg-card/60 hover-lift card-glow hover:border-primary/30">
              <CardContent className="flex items-center justify-between p-4">
                <Link to="/batches/$batchId" params={{ batchId: batch.id }} className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="flex items-center gap-2 font-semibold">
                    <Layers className="h-4 w-4 gradient-text" />
                    {batch.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {batch.task} · {batch.run_count} runs
                  </p>
                </Link>
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
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this batch?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" will be removed along with its run links. The underlying runs will remain. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {busy ? "Deleting…" : "Delete"}
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
    </main>
  );
}
