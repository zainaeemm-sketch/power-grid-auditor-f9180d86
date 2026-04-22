import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plus, FlaskConical, Pencil, Trash2, Sparkles, ChevronDown, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { listPresets, createPreset, deletePreset, updatePreset } from "@/server/runs.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useSoftDelete } from "@/hooks/useSoftDelete";
import { BulkActionBar } from "@/components/BulkActionBar";
import type { ExperimentPreset } from "@/types/grid-arena";
import { PresetAssistCard } from "@/components/presets/PresetAssistCard";
import type { PresetSuggestion } from "@/server/preset-assist.functions";
import { ALLOWED_EVALUATION_MODES, isAllowedEvaluationMode } from "@/lib/allowed-values";

export const Route = createFileRoute("/_authenticated/presets")({
  head: () => ({
    meta: [
      { title: "Presets — GridArena" },
      { name: "description", content: "Manage experiment presets." },
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
  component: PresetsPage,
});

function PresetsPage() {
  const { presets } = Route.useLoaderData() as { presets: ExperimentPreset[] };
  const router = useRouter();
  const createPresetFn = useServerFn(createPreset);
  const deletePresetFn = useServerFn(deletePreset);
  const updatePresetFn = useServerFn(updatePreset);
  const { pendingIds, softDelete, softDeleteMany } = useSoftDelete();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const clearSelection = () => setSelected(new Set());

  const visiblePresets = presets.filter((p) => !pendingIds.has(p.id));

  const handleBulkDelete = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkConfirmOpen(false);
    clearSelection();
    softDeleteMany(
      ids,
      `${ids.length} ${ids.length === 1 ? "preset" : "presets"}`,
      (id) => deletePresetFn({ data: { preset_id: id } }),
      () => router.invalidate(),
    );
  };

  const [deleteTarget, setDeleteTarget] = useState<ExperimentPreset | null>(null);
  const [editTarget, setEditTarget] = useState<ExperimentPreset | null>(null);
  const [editName, setEditName] = useState("");
  const [editProvider, setEditProvider] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editSystem, setEditSystem] = useState("");
  const [editTemp, setEditTemp] = useState("");
  const [editMax, setEditMax] = useState("");
  const [editTopP, setEditTopP] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const openEdit = (p: ExperimentPreset) => {
    const a = p as any;
    setEditTarget(p);
    setEditName(p.name ?? "");
    setEditProvider(a.provider_name ?? "");
    setEditModel(a.model_name ?? "");
    setEditSystem(a.system_prompt ?? "");
    setEditTemp(a.temperature != null ? String(a.temperature) : "");
    setEditMax(a.max_tokens != null ? String(a.max_tokens) : "");
    setEditTopP(a.top_p != null ? String(a.top_p) : "");
    setEditNotes(p.notes ?? "");
  };

  const handleDeletePreset = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    softDelete(
      target.id,
      target.name,
      () => deletePresetFn({ data: { preset_id: target.id } }),
      () => router.invalidate(),
    );
  };

  const handleEditSave = () => {
    if (!editTarget) return;
    setBusy(true);
    updatePresetFn({
      data: {
        preset_id: editTarget.id,
        name: editName,
        provider_name: editProvider || null,
        model_name: editModel || null,
        system_prompt: editSystem || null,
        temperature: editTemp ? parseFloat(editTemp) : null,
        max_tokens: editMax ? parseInt(editMax, 10) : null,
        top_p: editTopP ? parseFloat(editTopP) : null,
        notes: editNotes || null,
      },
    })
      .then(() => {
        toast.success("Preset updated");
        setEditTarget(null);
        return router.invalidate();
      })
      .catch((e: any) => toast.error(e?.message || "Failed"))
      .finally(() => setBusy(false));
  };

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [providerName, setProviderName] = useState("");
  const [modelName, setModelName] = useState("");
  const [promptVersion, setPromptVersion] = useState("");
  const [datasetVersion, setDatasetVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState("");
  const [maxTokens, setMaxTokens] = useState("");
  const [topP, setTopP] = useState("");
  const [promptTemplateVersion, setPromptTemplateVersion] = useState("");
  const [parserVersion, setParserVersion] = useState("");
  const [evalVersion, setEvalVersion] = useState("");
  const [evaluationMode, setEvaluationMode] = useState<"rule_based" | "simulation" | "auto">("rule_based");

  const resetForm = () => {
    setName(""); setProviderName(""); setModelName("");
    setPromptVersion(""); setDatasetVersion(""); setNotes(""); setDefaultPrompt("");
    setSystemPrompt(""); setTemperature(""); setMaxTokens(""); setTopP("");
    setPromptTemplateVersion(""); setParserVersion(""); setEvalVersion(""); setEvaluationMode("rule_based");
  };

  // ---- AI Assist state ----
  type PFieldKey = "name" | "provider_name" | "model_name" | "system_prompt" | "default_prompt_text" | "temperature" | "top_p" | "max_tokens" | "evaluation_mode" | "notes";
  type PDiffRow = { key: PFieldKey; label: string; current: string; next: string; isOverwrite: boolean };
  const [assistOpen, setAssistOpen] = useState(false);
  const [pendingPresetSuggestion, setPendingPresetSuggestion] = useState<PresetSuggestion | null>(null);
  const [pendingPresetDiff, setPendingPresetDiff] = useState<PDiffRow[]>([]);
  const [presetValidationError, setPresetValidationError] = useState<string | null>(null);

  const validatePresetSuggestion = (s: PresetSuggestion): string | null => {
    if (!s.name.trim() || s.name.length > 80) return "Suggested name must be 1–80 characters.";
    if (s.temperature < 0 || s.temperature > 2) return "Temperature must be between 0 and 2.";
    if (s.top_p < 0 || s.top_p > 1) return "Top-p must be between 0 and 1.";
    if (!Number.isInteger(s.max_tokens) || s.max_tokens < 1 || s.max_tokens > 8192) return "Max tokens must be an integer between 1 and 8192.";
    if (!isAllowedEvaluationMode(s.evaluation_mode)) return `Evaluation mode must be one of: ${ALLOWED_EVALUATION_MODES.join(", ")}.`;
    if (s.system_prompt.length > 4000) return "System prompt must be ≤ 4000 characters.";
    return null;
  };

  const buildPresetDiff = (s: PresetSuggestion): PDiffRow[] => {
    const rows: Array<{ key: PFieldKey; label: string; current: string; next: string }> = [
      { key: "name", label: "Name", current: name, next: s.name },
      { key: "provider_name", label: "Provider", current: providerName, next: s.provider_name },
      { key: "model_name", label: "Model", current: modelName, next: s.model_name },
      { key: "system_prompt", label: "System Prompt", current: systemPrompt, next: s.system_prompt },
      { key: "default_prompt_text", label: "Default Prompt", current: defaultPrompt, next: s.default_prompt_text },
      { key: "temperature", label: "Temperature", current: temperature, next: String(s.temperature) },
      { key: "top_p", label: "Top-p", current: topP, next: String(s.top_p) },
      { key: "max_tokens", label: "Max Tokens", current: maxTokens, next: String(s.max_tokens) },
      { key: "evaluation_mode", label: "Evaluation Mode", current: evaluationMode, next: s.evaluation_mode },
      { key: "notes", label: "Notes", current: notes, next: s.notes },
    ];
    return rows.map((r) => ({ ...r, isOverwrite: r.current.trim().length > 0 && r.current !== r.next }));
  };

  const applyPresetSuggestionDirect = (s: PresetSuggestion) => {
    setName(s.name);
    setProviderName(s.provider_name);
    setModelName(s.model_name);
    setSystemPrompt(s.system_prompt);
    setDefaultPrompt(s.default_prompt_text);
    setTemperature(String(s.temperature));
    setTopP(String(s.top_p));
    setMaxTokens(String(s.max_tokens));
    setEvaluationMode(s.evaluation_mode);
    setNotes(s.notes);
    toast.success("Suggestion applied to form");
  };

  const handlePresetAssistApply = (s: PresetSuggestion) => {
    const err = validatePresetSuggestion(s);
    setPresetValidationError(err);
    if (err) {
      toast.error("Suggestion failed validation");
      setPendingPresetSuggestion(s);
      setPendingPresetDiff([]);
      return;
    }
    const diff = buildPresetDiff(s);
    const hasOverwrite = diff.some((d) => d.isOverwrite);
    if (!hasOverwrite) {
      applyPresetSuggestionDirect(s);
      setPendingPresetSuggestion(null);
      return;
    }
    setPendingPresetSuggestion(s);
    setPendingPresetDiff(diff);
  };

  const confirmPresetApply = () => {
    if (!pendingPresetSuggestion) return;
    applyPresetSuggestionDirect(pendingPresetSuggestion);
    setPendingPresetSuggestion(null);
    setPendingPresetDiff([]);
    setPresetValidationError(null);
  };

  const cancelPresetApply = () => {
    setPendingPresetSuggestion(null);
    setPendingPresetDiff([]);
  };

  const showPresetDiffModal = !!pendingPresetSuggestion && pendingPresetDiff.length > 0 && !presetValidationError;

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
          system_prompt: systemPrompt || null,
          temperature: temperature ? parseFloat(temperature) : null,
          max_tokens: maxTokens ? parseInt(maxTokens, 10) : null,
          top_p: topP ? parseFloat(topP) : null,
          prompt_template_version: promptTemplateVersion || null,
          parser_version: parserVersion || null,
          evaluation_logic_version: evalVersion || null,
          evaluation_mode: evaluationMode,
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
        <h1 className="text-2xl font-extrabold animate-fade-up">
          <span className="gradient-text">Experiment Presets</span>
        </h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-primary to-[oklch(0.72_0.14_200)] text-primary-foreground font-semibold shadow-lg hover:shadow-[0_0_25px_oklch(0.696_0.17_162.48/0.3)] transition-shadow duration-300">
              <Plus className="mr-2 h-4 w-4" />
              New Preset
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Preset</DialogTitle>
            </DialogHeader>

            <Collapsible open={assistOpen} onOpenChange={setAssistOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md border border-border/60 bg-card/40 px-3 py-2 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Describe your preset with AI (optional)
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${assistOpen ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <PresetAssistCard onApply={handlePresetAssistApply} />
                {presetValidationError && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Cannot apply suggestion</AlertTitle>
                    <AlertDescription>
                      {presetValidationError}{" "}
                      <button
                        className="ml-1 underline"
                        onClick={() => { setPresetValidationError(null); setPendingPresetSuggestion(null); }}
                      >
                        Dismiss
                      </button>
                    </AlertDescription>
                  </Alert>
                )}
              </CollapsibleContent>
            </Collapsible>

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
              <div className="space-y-2">
                <Label>System Prompt</Label>
                <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={3} placeholder="System message sent to the LLM…" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Temperature</Label>
                  <Input value={temperature} onChange={(e) => setTemperature(e.target.value)} type="number" step="0.1" placeholder="0.2" />
                </div>
                <div className="space-y-2">
                  <Label>Max Tokens</Label>
                  <Input value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} type="number" placeholder="1024" />
                </div>
                <div className="space-y-2">
                  <Label>Top-p</Label>
                  <Input value={topP} onChange={(e) => setTopP(e.target.value)} type="number" step="0.05" placeholder="1.0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Prompt Template Ver.</Label>
                  <Input value={promptTemplateVersion} onChange={(e) => setPromptTemplateVersion(e.target.value)} placeholder="e.g. v1" />
                </div>
                <div className="space-y-2">
                  <Label>Prompt Version</Label>
                  <Input value={promptVersion} onChange={(e) => setPromptVersion(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Parser Version</Label>
                  <Input value={parserVersion} onChange={(e) => setParserVersion(e.target.value)} placeholder="v1" />
                </div>
                <div className="space-y-2">
                  <Label>Evaluation Version</Label>
                  <Input value={evalVersion} onChange={(e) => setEvalVersion(e.target.value)} placeholder="v1" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Dataset Version</Label>
                  <Input value={datasetVersion} onChange={(e) => setDatasetVersion(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Evaluation Mode</Label>
                <select
                  value={evaluationMode}
                  onChange={(e) => setEvaluationMode(e.target.value as any)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="rule_based">Rule-based (deterministic heuristic)</option>
                  <option value="simulation">Simulation-based (DC PF / pandapower)</option>
                  <option value="auto">Auto (simulation → rule-based fallback)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Default Prompt Text (user message)</Label>
                <Textarea value={defaultPrompt} onChange={(e) => setDefaultPrompt(e.target.value)} rows={3} placeholder="Template prompt text…" />
              </div>
              <Button type="submit" className="w-full bg-gradient-to-r from-primary to-[oklch(0.72_0.14_200)] text-primary-foreground font-semibold" disabled={submitting}>
                {submitting ? "Creating…" : "Create Preset"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {visiblePresets.length > 0 && (
        <div className="mb-2 flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <Checkbox
            checked={
              selected.size > 0 && visiblePresets.every((p) => selected.has(p.id))
                ? true
                : selected.size > 0
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(v) => {
              if (v) setSelected(new Set(visiblePresets.map((p) => p.id)));
              else clearSelection();
            }}
            aria-label="Select all presets"
          />
          <span>Select all ({visiblePresets.length})</span>
        </div>
      )}

      <div className="grid gap-4 pb-24 sm:grid-cols-2">
        {visiblePresets.map((preset: ExperimentPreset, i: number) => {
          const p = preset as any;
          const isSelected = selected.has(preset.id);
          return (
            <Card
              key={preset.id}
              className={`gradient-border-left border-border/40 bg-card/60 hover-lift card-glow animate-fade-up ${isSelected ? "ring-1 ring-primary/60" : ""}`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleOne(preset.id)}
                    aria-label={`Select ${preset.name}`}
                  />
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <FlaskConical className="h-4 w-4 gradient-text" />
                    {preset.name}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" title="Edit preset" onClick={() => openEdit(preset)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Delete preset" onClick={() => setDeleteTarget(preset)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <Row label="Provider" value={preset.provider_name} />
                <Row label="Model" value={preset.model_name} />
                <Row label="Temperature" value={p.temperature} />
                <Row label="Max tokens" value={p.max_tokens} />
                <Row label="Top-p" value={p.top_p} />
                <Row label="Prompt template" value={p.prompt_template_version} />
                <Row label="Parser ver." value={p.parser_version} />
                <Row label="Eval ver." value={p.evaluation_logic_version} />
                <Row label="Dataset" value={preset.dataset_version} />
                {preset.notes && <p className="mt-2 text-muted-foreground">{preset.notes}</p>}
              </CardContent>
            </Card>
          );
        })}
        {presets.length === 0 && (
          <p className="col-span-2 py-12 text-center text-muted-foreground">No presets yet.</p>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this preset?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" will be removed. You'll have 5 seconds to undo before it's permanently deleted. Existing runs that referenced it are unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePreset} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit preset</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Provider</Label><Input value={editProvider} onChange={(e) => setEditProvider(e.target.value)} /></div>
              <div className="space-y-2"><Label>Model</Label><Input value={editModel} onChange={(e) => setEditModel(e.target.value)} /></div>
            </div>
            <div className="space-y-2">
              <Label>System prompt</Label>
              <Textarea value={editSystem} onChange={(e) => setEditSystem(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Temperature</Label><Input value={editTemp} onChange={(e) => setEditTemp(e.target.value)} type="number" step="0.1" /></div>
              <div className="space-y-2"><Label>Max tokens</Label><Input value={editMax} onChange={(e) => setEditMax(e.target.value)} type="number" /></div>
              <div className="space-y-2"><Label>Top-p</Label><Input value={editTopP} onChange={(e) => setEditTopP(e.target.value)} type="number" step="0.05" /></div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={busy}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={busy || !editName.trim()}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} {selected.size === 1 ? "preset" : "presets"}?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll have 5 seconds to undo. After that, the selected presets will be permanently deleted. Existing runs that referenced them are unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BulkActionBar
        count={selected.size}
        itemLabel="preset"
        onDelete={() => setBulkConfirmOpen(true)}
        onClear={clearSelection}
      />

      <AlertDialog open={showPresetDiffModal} onOpenChange={(o) => !o && cancelPresetApply()}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Apply AI suggestion?</AlertDialogTitle>
            <AlertDialogDescription>
              Some fields already contain values. Review what will change before applying.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto text-sm">
            {pendingPresetDiff.map((row) => (
              <div key={row.key} className="rounded-md border border-border/60 p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold">{row.label}</span>
                  <span className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${row.isOverwrite ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
                    {row.isOverwrite ? "OVERWRITE" : "NEW"}
                  </span>
                </div>
                {row.isOverwrite && row.current && (
                  <div className="text-xs text-muted-foreground line-through mb-0.5 break-words whitespace-pre-wrap">{row.current}</div>
                )}
                <div className="text-xs text-foreground break-words whitespace-pre-wrap">{row.next || <em className="text-muted-foreground">(empty)</em>}</div>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelPresetApply}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPresetApply}>Apply to form</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function Row({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">{value === null || value === undefined || value === "" ? "—" : String(value)}</span>
    </div>
  );
}
