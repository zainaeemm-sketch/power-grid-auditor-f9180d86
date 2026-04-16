import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, FlaskConical } from "lucide-react";
import { listPresets, createPreset } from "@/server/runs.functions";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import type { ExperimentPreset } from "@/types/grid-arena";

export const Route = createFileRoute("/_authenticated/presets")({
  head: () => ({
    meta: [
      { title: "Presets — GridArena" },
      { name: "description", content: "Manage experiment presets." },
    ],
  }),
  loader: async () => {
    try {
      return await listPresets();
    } catch {
      return { presets: [] };
    }
  },
  component: PresetsPage,
});

function PresetsPage() {
  const { presets } = Route.useLoaderData() as { presets: ExperimentPreset[] };
  const router = useRouter();
  const createPresetFn = useServerFn(createPreset);

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [providerName, setProviderName] = useState("");
  const [modelName, setModelName] = useState("");
  const [promptVersion, setPromptVersion] = useState("");
  const [datasetVersion, setDatasetVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [defaultPrompt, setDefaultPrompt] = useState("");

  const resetForm = () => {
    setName("");
    setProviderName("");
    setModelName("");
    setPromptVersion("");
    setDatasetVersion("");
    setNotes("");
    setDefaultPrompt("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createPresetFn({
        data: {
          name,
          provider_name: providerName || null,
          model_name: modelName || null,
          prompt_version: promptVersion || null,
          dataset_version: datasetVersion || null,
          notes: notes || null,
          default_prompt_text: defaultPrompt || null,
        },
      });
      resetForm();
      setOpen(false);
      router.invalidate();
    } catch (err) {
      console.error("Failed to create preset:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Experiment Presets</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Preset
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Preset</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. GPT-4o Baseline" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Input value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="e.g. openai" />
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="e.g. gpt-4o" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Prompt Version</Label>
                  <Input value={promptVersion} onChange={(e) => setPromptVersion(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Dataset Version</Label>
                  <Input value={datasetVersion} onChange={(e) => setDatasetVersion(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Default Prompt Text</Label>
                <Textarea value={defaultPrompt} onChange={(e) => setDefaultPrompt(e.target.value)} rows={3} placeholder="Template prompt text…" />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Creating…" : "Create Preset"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {presets.map((preset: ExperimentPreset) => (
          <Card key={preset.id} className="border-border/60 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FlaskConical className="h-4 w-4 text-primary" />
                {preset.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Provider</span>
                <span>{preset.provider_name || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model</span>
                <span>{preset.model_name || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prompt Version</span>
                <span>{preset.prompt_version || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dataset</span>
                <span>{preset.dataset_version || "—"}</span>
              </div>
              {preset.notes && (
                <p className="mt-2 text-muted-foreground">{preset.notes}</p>
              )}
            </CardContent>
          </Card>
        ))}
        {presets.length === 0 && (
          <p className="col-span-2 py-12 text-center text-muted-foreground">No presets yet.</p>
        )}
      </div>
    </main>
  );
}
