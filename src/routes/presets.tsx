import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FlaskConical } from "lucide-react";

export const Route = createFileRoute("/presets")({
  head: () => ({
    meta: [
      { title: "Presets — GridArena" },
      { name: "description", content: "Manage experiment presets." },
    ],
  }),
  component: PresetsPage,
});

const samplePresets = [
  { id: "1", name: "GPT-4o Default", provider_name: "OpenAI", model_name: "gpt-4o", prompt_version: "v1.0", dataset_version: "ieee14-base", notes: "Default config for GPT-4o agent" },
  { id: "2", name: "Claude Contingency", provider_name: "Anthropic", model_name: "claude-3.5-sonnet", prompt_version: "v2.1", dataset_version: "ieee39-contingency", notes: "Contingency analysis preset" },
];

function PresetsPage() {
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
        {samplePresets.map((preset) => (
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
                <span>{preset.provider_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model</span>
                <span>{preset.model_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prompt Version</span>
                <span>{preset.prompt_version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dataset</span>
                <span>{preset.dataset_version}</span>
              </div>
              {preset.notes && (
                <p className="mt-2 text-muted-foreground">{preset.notes}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
