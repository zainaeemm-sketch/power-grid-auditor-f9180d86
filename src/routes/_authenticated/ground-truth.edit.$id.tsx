import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getScenario, updateScenario } from "@/server/ground-truth.functions";
import type { GroundTruthScenarioWithActions } from "@/types/grid-arena";

export const Route = createFileRoute("/_authenticated/ground-truth/edit/$id")({
  head: () => ({ meta: [{ title: "Edit Ground Truth Scenario — GridArena" }] }),
  loader: async ({ params }) => {
    if (typeof window === "undefined") return null;
    try {
      return await getScenario({ data: { id: params.id } });
    } catch {
      return null;
    }
  },
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-destructive">Error: {error.message}</p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-muted-foreground">Scenario not found.</p>
    </main>
  ),
  component: EditScenarioPage,
});

interface ActionForm {
  action_type: string;
  target_index: string;
  value: string;
  expected_feasibility: boolean;
  expected_violations: string;
  expected_violation_improvement: string;
  notes: string;
}

const emptyAction = (): ActionForm => ({
  action_type: "",
  target_index: "",
  value: "",
  expected_feasibility: true,
  expected_violations: "0",
  expected_violation_improvement: "0",
  notes: "",
});

function EditScenarioPage() {
  const data = Route.useLoaderData() as GroundTruthScenarioWithActions | null;
  const navigate = useNavigate();
  const updateFn = useServerFn(updateScenario);

  const [scenarioId, setScenarioId] = useState(data?.scenario.scenario_id ?? "");
  const [caseName, setCaseName] = useState(data?.scenario.case_name ?? "");
  const [description, setDescription] = useState(data?.scenario.scenario_description ?? "");
  const [difficulty, setDifficulty] = useState(data?.scenario.difficulty_level ?? "medium");
  const [actions, setActions] = useState<ActionForm[]>(
    data && data.actions.length > 0
      ? data.actions.map((a) => ({
          action_type: a.action_type,
          target_index: a.target_index == null ? "" : String(a.target_index),
          value: a.value == null ? "" : String(a.value),
          expected_feasibility: a.expected_feasibility,
          expected_violations: String(a.expected_violations),
          expected_violation_improvement: String(a.expected_violation_improvement),
          notes: a.notes ?? "",
        }))
      : [emptyAction()],
  );
  const [submitting, setSubmitting] = useState(false);

  if (!data) {
    return <main className="mx-auto max-w-3xl px-4 py-8"><p className="text-muted-foreground">Loading…</p></main>;
  }

  const updateAction = (idx: number, patch: Partial<ActionForm>) => {
    setActions((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateFn({
        data: {
          id: data.scenario.id,
          scenario_id: scenarioId,
          case_name: caseName,
          scenario_description: description || null,
          difficulty_level: difficulty,
          actions: actions.map((a) => ({
            action_type: a.action_type,
            target_index: a.target_index === "" ? null : Number(a.target_index),
            value: a.value === "" ? null : Number(a.value),
            expected_feasibility: a.expected_feasibility,
            expected_violations: Number(a.expected_violations || 0),
            expected_violation_improvement: Number(a.expected_violation_improvement || 0),
            notes: a.notes || null,
          })),
        },
      });
      toast.success("Scenario updated");
      navigate({ to: "/ground-truth/$id", params: { id: data.scenario.id } });
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4">
        <Button variant="outline" size="sm" asChild>
          <Link to="/ground-truth/$id" params={{ id: data.scenario.id }}>
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Back
          </Link>
        </Button>
      </div>
      <h1 className="mb-6 text-2xl font-extrabold"><span className="gradient-text">Edit Ground Truth Scenario</span></h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="border-border/40 bg-card/60">
          <CardHeader><CardTitle className="text-base font-bold">Scenario</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Scenario ID</Label>
                <Input value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Case Name</Label>
                <Input value={caseName} onChange={(e) => setCaseName(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold">Reference Actions</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => setActions((p) => [...p, emptyAction()])}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />Add action
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {actions.map((a, idx) => (
              <div key={idx} className="space-y-3 rounded-md border border-border/40 bg-background/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Action #{idx + 1}</span>
                  {actions.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setActions((p) => p.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">action_type</Label>
                    <Input value={a.action_type} onChange={(e) => updateAction(idx, { action_type: e.target.value })} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">target_index</Label>
                    <Input type="number" value={a.target_index} onChange={(e) => updateAction(idx, { target_index: e.target.value })} placeholder="—" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">value</Label>
                    <Input type="number" step="any" value={a.value} onChange={(e) => updateAction(idx, { value: e.target.value })} placeholder="—" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">expected_violations</Label>
                    <Input type="number" value={a.expected_violations} onChange={(e) => updateAction(idx, { expected_violations: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">expected_improvement</Label>
                    <Input type="number" step="any" value={a.expected_violation_improvement} onChange={(e) => updateAction(idx, { expected_violation_improvement: e.target.value })} />
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border/40 px-3">
                    <Label className="text-xs">expected_feasibility</Label>
                    <Switch checked={a.expected_feasibility} onCheckedChange={(v) => updateAction(idx, { expected_feasibility: v })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">notes</Label>
                  <Textarea value={a.notes} onChange={(e) => updateAction(idx, { notes: e.target.value })} rows={2} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/ground-truth/$id", params: { id: data.scenario.id } })}>Cancel</Button>
          <Button type="submit" disabled={submitting} className="bg-gradient-to-r from-primary to-[oklch(0.72_0.14_200)] text-primary-foreground">
            {submitting ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </form>
    </main>
  );
}
