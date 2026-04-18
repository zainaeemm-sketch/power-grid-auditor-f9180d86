import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Target, Sparkles, Globe, Lock, ShieldCheck, Pencil, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listScenarios, seedExampleScenarios, claimFirstAdmin, deleteScenario } from "@/server/ground-truth.functions";
import { useSoftDelete } from "@/hooks/useSoftDelete";
import type { GroundTruthScenarioListItem } from "@/types/grid-arena";

export const Route = createFileRoute("/_authenticated/ground-truth/")({
  head: () => ({
    meta: [
      { title: "Ground Truth — GridArena" },
      { name: "description", content: "Reference scenarios and expected actions for benchmarking." },
    ],
  }),
  loader: async () => {
    if (typeof window === "undefined") return { scenarios: [], isAdmin: false };
    try {
      return await listScenarios();
    } catch {
      return { scenarios: [], isAdmin: false };
    }
  },
  component: GroundTruthListPage,
});

function GroundTruthListPage() {
  const { scenarios, isAdmin } = Route.useLoaderData() as { scenarios: GroundTruthScenarioListItem[]; isAdmin: boolean };
  const router = useRouter();
  const seedFn = useServerFn(seedExampleScenarios);
  const claimFn = useServerFn(claimFirstAdmin);
  const deleteFn = useServerFn(deleteScenario);
  const { pendingIds, softDelete } = useSoftDelete();
  const [seeding, setSeeding] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GroundTruthScenarioListItem | null>(null);
  const [busy, setBusy] = useState(false);

  const handleDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    softDelete(
      target.id,
      target.scenario_id,
      () => deleteFn({ data: { id: target.id } }),
      () => router.invalidate(),
    );
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const { inserted } = await seedFn();
      toast.success(`Seeded ${inserted} example scenario${inserted === 1 ? "" : "s"}.`);
      await router.invalidate();
    } catch (err: any) {
      toast.error(err.message || "Failed to seed");
    } finally {
      setSeeding(false);
    }
  };

  const handleClaimAdmin = async () => {
    setClaiming(true);
    try {
      const res = await claimFn();
      if (res.granted) {
        toast.success("You are now an admin.");
        await router.invalidate();
      } else {
        toast.info(res.reason || "Admin already exists");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to claim admin");
    } finally {
      setClaiming(false);
    }
  };

  const publicCount = scenarios.filter((s) => s.is_public).length;
  const ownCount = scenarios.filter((s) => s.is_owner).length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold"><span className="gradient-text">Ground Truth Registry</span></h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reference scenarios with expected optimal actions for accuracy benchmarking.
            {isAdmin && <span className="ml-2 inline-flex items-center gap-1 text-primary"><ShieldCheck className="h-3 w-3" />Admin</span>}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{publicCount} shared · {ownCount} owned by you</p>
        </div>
        <div className="flex items-center gap-2">
          {!isAdmin && (
            <Button variant="ghost" size="sm" onClick={handleClaimAdmin} disabled={claiming} title="Claim admin role if none exists yet">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              {claiming ? "Claiming…" : "Claim admin"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {seeding ? "Seeding…" : "Seed examples"}
          </Button>
          <Button asChild size="sm" className="bg-gradient-to-r from-primary to-[oklch(0.72_0.14_200)] text-primary-foreground">
            <Link to="/ground-truth/new">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Scenario
            </Link>
          </Button>
        </div>
      </div>

      {scenarios.length === 0 ? (
        <Card className="border-border/40 bg-card/60">
          <CardContent className="py-12 text-center">
            <Target className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">No ground truth scenarios yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">Click "Seed examples" to add sample scenarios or "New Scenario" to create your own.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {scenarios.filter((s) => !pendingIds.has(s.id)).map((s) => (
            <Card key={s.id} className="border-border/40 bg-card/60 transition hover:border-primary/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm font-bold">
                  <Link to="/ground-truth/$id" params={{ id: s.id }} className="font-mono text-primary hover:underline">
                    {s.scenario_id}
                  </Link>
                  <div className="flex items-center gap-1.5">
                    {s.is_public ? (
                      <Badge variant="default" className="gap-1 text-[10px]"><Globe className="h-3 w-3" />Shared</Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 text-[10px]"><Lock className="h-3 w-3" />Private</Badge>
                    )}
                    <Badge variant="outline" className="text-xs">{s.difficulty_level}</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                <Link to="/ground-truth/$id" params={{ id: s.id }} className="block space-y-1">
                  <div><span className="text-muted-foreground">Case:</span> {s.case_name}</div>
                  <div className="line-clamp-2 text-muted-foreground">{s.scenario_description || "—"}</div>
                </Link>
                <div className="flex items-center justify-between pt-1">
                  <span><span className="text-muted-foreground">Reference actions:</span> {s.action_count}</span>
                  <div className="flex items-center gap-1">
                    {s.is_owner ? (
                      <>
                        <Button asChild variant="ghost" size="icon" title="Edit scenario" className="h-7 w-7">
                          <Link to="/ground-truth/edit/$id" params={{ id: s.id }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" title="Delete scenario" className="h-7 w-7" onClick={() => setDeleteTarget(s)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">read-only</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this scenario?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.scenario_id}" will be removed. You'll have 5 seconds to undo before it and its reference actions are permanently deleted.
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
    </main>
  );
}
