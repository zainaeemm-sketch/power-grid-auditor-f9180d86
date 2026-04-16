import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FlaskConical } from "lucide-react";
import { listPresets } from "@/server/runs.functions";
import type { ExperimentPreset } from "@/types/grid-arena";

export const Route = createFileRoute("/presets")({
  head: () => ({
    meta: [
      { title: "Presets — GridArena" },
      { name: "description", content: "Manage experiment presets." },
    ],
  }),
  loader: () => listPresets(),
  component: PresetsPage,
});

function PresetsPage() {
  const { presets } = Route.useLoaderData() as { presets: ExperimentPreset[] };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Experiment Presets</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Preset
        </Button>
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
