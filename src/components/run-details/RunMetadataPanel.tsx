import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { updateRunMetadata } from "@/server/runs.functions";
import type { RunMetadata } from "@/types/grid-arena";

interface RunMetadataPanelProps {
  runId: string;
  metadata: RunMetadata | null;
}

export function RunMetadataPanel({ runId, metadata }: RunMetadataPanelProps) {
  const updateMetaFn = useServerFn(updateRunMetadata);
  const [providerName, setProviderName] = useState(metadata?.provider_name ?? "");
  const [providerUrl, setProviderUrl] = useState(metadata?.provider_base_url ?? "");
  const [modelName, setModelName] = useState(metadata?.model_name ?? "");
  const [modelVersion, setModelVersion] = useState(metadata?.model_version ?? "");
  const [promptVersion, setPromptVersion] = useState(metadata?.prompt_version ?? "");
  const [datasetVersion, setDatasetVersion] = useState(metadata?.dataset_version ?? "");
  const [randomSeed, setRandomSeed] = useState(metadata?.random_seed?.toString() ?? "");
  const [notes, setNotes] = useState(metadata?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateMetaFn({
        data: {
          run_id: runId,
          provider_name: providerName || null,
          provider_base_url: providerUrl || null,
          model_name: modelName || null,
          model_version: modelVersion || null,
          prompt_version: promptVersion || null,
          dataset_version: datasetVersion || null,
          random_seed: randomSeed ? parseInt(randomSeed, 10) : null,
          notes: notes || null,
        },
      });
      toast.success("Metadata saved");
    } catch {
      toast.error("Failed to save metadata");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Experiment Metadata</CardTitle>
        <Button size="sm" variant="outline" onClick={save} disabled={saving}>
          <Save className="mr-1 h-3 w-3" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Field label="Provider" value={providerName} onChange={setProviderName} placeholder="e.g. openai" />
        <Field label="Base URL" value={providerUrl} onChange={setProviderUrl} placeholder="https://..." />
        <Field label="Model" value={modelName} onChange={setModelName} placeholder="e.g. gpt-4o" />
        <Field label="Model Version" value={modelVersion} onChange={setModelVersion} />
        <Field label="Prompt Version" value={promptVersion} onChange={setPromptVersion} />
        <Field label="Dataset Version" value={datasetVersion} onChange={setDatasetVersion} />
        <Field label="Random Seed" value={randomSeed} onChange={setRandomSeed} type="number" />
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange, placeholder, type }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} />
    </div>
  );
}
