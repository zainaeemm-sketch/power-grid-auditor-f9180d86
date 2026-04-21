import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { createBatch } from "@/server/batch.functions";
import { listPresets } from "@/server/runs.functions";
import type { ExperimentPreset } from "@/types/grid-arena";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { PresetSelectItem } from "@/components/PresetSelectItem";

export const Route = createFileRoute("/_authenticated/batches/new")({
  head: () => ({
    meta: [{ title: "New Batch — GridArena" }],
  }),
  loader: async () => {
    if (typeof window === "undefined") return { presets: [] };
    try {
      return await listPresets();
    } catch {
      return { presets: [] };
    }
  },
  component: NewBatchPage,
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

function NewBatchPage() {
  const { presets } = Route.useLoaderData() as { presets: ExperimentPreset[] };
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [task, setTask] = useState("");
  const [researchQuestion, setResearchQuestion] = useState("");
  const [agentsText, setAgentsText] = useState("");
  const [casesText, setCasesText] = useState("");
  const [presetId, setPresetId] = useState<string | undefined>(undefined);

  const agents = agentsText.split(",").map((s) => s.trim()).filter(Boolean);
  const cases = casesText.split(",").map((s) => s.trim()).filter(Boolean);
  const totalRuns = agents.length * cases.length;

  const handleSubmit = async () => {
    if (!name || !task || agents.length === 0 || cases.length === 0) {
      toast.error("Please fill in name, task, agents, and cases.");
      return;
    }
    setSubmitting(true);
    try {
      const { batch } = await createBatch({
        data: {
          name,
          task,
          research_question: researchQuestion || undefined,
          agents,
          cases,
          preset_id: presetId,
        },
      });
      toast.success(`Batch created with ${totalRuns} runs`);
      navigate({ to: "/batches/$batchId", params: { batchId: batch.id } });
    } catch (err: any) {
      toast.error(err.message || "Failed to create batch");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Create Batch Experiment</h1>

      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Batch Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Batch Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. IEEE 14-Bus Sweep" />
          </div>

          <div className="space-y-2">
            <Label>Task</Label>
            <Input value={task} onChange={(e) => setTask(e.target.value)} placeholder="e.g. load_scaling" />
          </div>

          <div className="space-y-2">
            <Label>Research Question (optional)</Label>
            <Textarea
              value={researchQuestion}
              onChange={(e) => setResearchQuestion(e.target.value)}
              placeholder="e.g. How do agents compare on load scaling?"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Agents (comma-separated)</Label>
            <Input
              value={agentsText}
              onChange={(e) => setAgentsText(e.target.value)}
              placeholder="e.g. poweragent, powerfm, gridgpt"
            />
            {agents.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {agents.map((a) => (
                  <span key={a} className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary">{a}</span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Benchmark Cases (comma-separated)</Label>
            <Input
              value={casesText}
              onChange={(e) => setCasesText(e.target.value)}
              placeholder="e.g. ieee14, ieee39, ieee118"
            />
            {cases.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {cases.map((c) => (
                  <span key={c} className="rounded-full bg-accent px-2 py-0.5 text-xs">{c}</span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Preset (optional)</Label>
            <Select value={presetId ?? "none"} onValueChange={(v) => setPresetId(v === "none" ? undefined : v)}>
              <SelectTrigger>
                <SelectValue placeholder="No preset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No preset</SelectItem>
                {presets.map((p) => (
                  <PresetSelectItem key={p.id} id={p.id} name={p.name} />
                ))}
              </SelectContent>
            </Select>
          </div>

          {totalRuns > 0 && (
            <p className="text-sm text-muted-foreground">
              This will create <span className="font-semibold text-foreground">{totalRuns}</span> runs ({agents.length} agents × {cases.length} cases).
            </p>
          )}

          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? "Creating…" : "Create Batch"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
