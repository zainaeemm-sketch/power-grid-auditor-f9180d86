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
  const m = (metadata ?? {}) as any;
  const [providerName, setProviderName] = useState(m.provider_name ?? "");
  const [providerUrl, setProviderUrl] = useState(m.provider_base_url ?? "");
  const [modelName, setModelName] = useState(m.model_name ?? "");
  const [modelVersion, setModelVersion] = useState(m.model_version ?? "");
  const [promptVersion, setPromptVersion] = useState(m.prompt_version ?? "");
  const [datasetVersion, setDatasetVersion] = useState(m.dataset_version ?? "");
  const [randomSeed, setRandomSeed] = useState(m.random_seed?.toString() ?? "");
  const [notes, setNotes] = useState(m.notes ?? "");
  const [systemPrompt, setSystemPrompt] = useState(m.system_prompt ?? "");
  const [temperature, setTemperature] = useState(m.temperature?.toString() ?? "");
  const [maxTokens, setMaxTokens] = useState(m.max_tokens?.toString() ?? "");
  const [topP, setTopP] = useState(m.top_p?.toString() ?? "");
  const [promptTemplateVersion, setPromptTemplateVersion] = useState(m.prompt_template_version ?? "");
  const [parserVersion, setParserVersion] = useState(m.parser_version ?? "");
  const [evalVersion, setEvalVersion] = useState(m.evaluation_logic_version ?? "");
  const [benchmarkCaseVersion, setBenchmarkCaseVersion] = useState(m.benchmark_case_version ?? "");
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
          system_prompt: systemPrompt || null,
          temperature: temperature ? parseFloat(temperature) : null,
          max_tokens: maxTokens ? parseInt(maxTokens, 10) : null,
          top_p: topP ? parseFloat(topP) : null,
          prompt_template_version: promptTemplateVersion || null,
          parser_version: parserVersion || null,
          evaluation_logic_version: evalVersion || null,
          benchmark_case_version: benchmarkCaseVersion || null,
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
        <CardTitle className="text-base">Edit Run Configuration</CardTitle>
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
        <Field label="Temperature" value={temperature} onChange={setTemperature} type="number" placeholder="0.2" />
        <Field label="Max Tokens" value={maxTokens} onChange={setMaxTokens} type="number" placeholder="1024" />
        <Field label="Top-p" value={topP} onChange={setTopP} type="number" placeholder="1.0" />
        <Field label="Random Seed" value={randomSeed} onChange={setRandomSeed} type="number" />
        <Field label="Prompt Template Ver." value={promptTemplateVersion} onChange={setPromptTemplateVersion} placeholder="v1" />
        <Field label="Prompt Version" value={promptVersion} onChange={setPromptVersion} />
        <Field label="Parser Version" value={parserVersion} onChange={setParserVersion} placeholder="v1" />
        <Field label="Evaluation Version" value={evalVersion} onChange={setEvalVersion} placeholder="v1" />
        <Field label="Dataset Version" value={datasetVersion} onChange={setDatasetVersion} />
        <Field label="Benchmark Case Ver." value={benchmarkCaseVersion} onChange={setBenchmarkCaseVersion} />
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">System Prompt</Label>
          <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={3} placeholder="System message sent to the LLM…" />
        </div>
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
