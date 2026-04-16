import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { listPresets, createRun } from "@/server/runs.functions";
import { useServerFn } from "@tanstack/react-start";
import type { ExperimentPreset } from "@/types/grid-arena";
import { Play } from "lucide-react";

export const Route = createFileRoute("/_authenticated/new-run")({
  head: () => ({
    meta: [
      { title: "New Run — GridArena" },
      { name: "description", content: "Create a new experiment run." },
    ],
  }),
  loader: async () => {
    if (typeof window === "undefined") return { presets: [] };
    try {
      return await listPresets();
    } catch {
      return { presets: [] };
    }
  },
  component: NewRunPage,
});

function NewRunPage() {
  const { presets } = Route.useLoaderData() as { presets: ExperimentPreset[] };
  const navigate = useNavigate();
  const createRunFn = useServerFn(createRun);

  const [title, setTitle] = useState("");
  const [task, setTask] = useState("");
  const [agent, setAgent] = useState("");
  const [caseName, setCaseName] = useState("");
  const [researchQuestion, setResearchQuestion] = useState("");
  const [presetId, setPresetId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const handlePresetChange = (value: string) => {
    setPresetId(value === "none" ? "" : value);
    if (value !== "none") {
      const preset = presets.find((p: ExperimentPreset) => p.id === value);
      if (preset) {
        setAgent(preset.model_name || "");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await createRunFn({
        data: {
          title,
          task,
          agent,
          case_name: caseName,
          research_question: researchQuestion || undefined,
          preset_id: presetId || undefined,
        },
      });
      navigate({ to: "/runs/$runId", params: { runId: result.run.id } });
    } catch (err) {
      console.error("Failed to create run:", err);
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-extrabold animate-fade-up">
        <span className="gradient-text">New Experiment Run</span>
      </h1>

      <form onSubmit={handleSubmit}>
        <Card className="border-border/40 bg-card/60 card-glow animate-fade-up" style={{ animationDelay: "100ms" }}>
          <CardHeader>
            <CardTitle className="text-base font-bold">Run Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Preset (optional)</Label>
              <Select value={presetId || "none"} onValueChange={handlePresetChange}>
                <SelectTrigger><SelectValue placeholder="Select a preset..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No preset</SelectItem>
                  {presets.map((p: ExperimentPreset) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Run Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Load Scaling Test" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task">Task</Label>
                <Input id="task" value={task} onChange={(e) => setTask(e.target.value)} placeholder="e.g., load_scaling" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent">Agent</Label>
                <Input id="agent" value={agent} onChange={(e) => setAgent(e.target.value)} placeholder="e.g., gpt-4o" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="case">Benchmark Case</Label>
              <Input id="case" value={caseName} onChange={(e) => setCaseName(e.target.value)} placeholder="e.g., ieee14" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rq">Research Question</Label>
              <Textarea id="rq" value={researchQuestion} onChange={(e) => setResearchQuestion(e.target.value)} placeholder="What is this experiment trying to answer?" rows={3} />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-[oklch(0.72_0.14_200)] text-primary-foreground font-semibold shadow-lg hover:shadow-[0_0_25px_oklch(0.696_0.17_162.48/0.3)] transition-shadow duration-300"
              disabled={submitting}
            >
              <Play className="mr-2 h-4 w-4" />
              {submitting ? "Creating…" : "Create Run"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </main>
  );
}
