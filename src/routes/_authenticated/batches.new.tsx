import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useState } from "react";
import { createBatch } from "@/server/batch.functions";
import { listPresets } from "@/server/runs.functions";
import type { ExperimentPreset } from "@/types/grid-arena";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { PresetGroupedList } from "@/components/PresetSelectItem";
import { BatchAssistCard } from "@/components/batch/BatchAssistCard";
import type { BatchSuggestion } from "@/server/batch-assist.functions";
import { ALLOWED_AGENTS, ALLOWED_CASES, isAllowedAgent, isAllowedCase } from "@/lib/allowed-values";

export const Route = createFileRoute("/_authenticated/batches/new")({
  head: () => ({
    meta: [{ title: "New Batch — GridArena" }],
  }),
  validateSearch: (search: Record<string, unknown>): { cases?: string } => {
    const cases = typeof search.cases === "string" ? (search.cases as string) : undefined;
    return cases ? { cases } : {};
  },
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

type FieldKey = "name" | "task" | "research_question" | "agents" | "cases";

type DiffRow = {
  key: FieldKey;
  label: string;
  current: string;
  next: string;
  isOverwrite: boolean;
};

function NewBatchPage() {
  const { presets } = Route.useLoaderData() as { presets: ExperimentPreset[] };
  const search = Route.useSearch() as { cases?: string };
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [task, setTask] = useState("");
  const [researchQuestion, setResearchQuestion] = useState("");
  const [agentsText, setAgentsText] = useState("");
  const [casesText, setCasesText] = useState(search.cases ?? "");
  const [presetId, setPresetId] = useState<string | undefined>(undefined);
  const [evaluationMode, setEvaluationMode] = useState<"simulation" | "auto" | "rule_based">("simulation");

  const [pendingSuggestion, setPendingSuggestion] = useState<BatchSuggestion | null>(null);
  const [pendingDiff, setPendingDiff] = useState<DiffRow[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [softWarning, setSoftWarning] = useState<string | null>(null);

  const agents = agentsText.split(",").map((s) => s.trim()).filter(Boolean);
  const cases = casesText.split(",").map((s) => s.trim()).filter(Boolean);
  const invalidCases = cases.filter((c) => !isAllowedCase(c));
  const totalRuns = agents.length * cases.length;

  const validateSuggestion = (s: BatchSuggestion): { hardError: string | null; softWarning: string | null } => {
    if (!s.name.trim() || s.name.length > 80) return { hardError: "Suggested name must be 1–80 characters.", softWarning: null };
    if (!s.task.trim() || s.task.length > 60) return { hardError: "Suggested task must be 1–60 characters.", softWarning: null };
    if (s.agents.length === 0) return { hardError: "Suggestion has no agents.", softWarning: null };
    if (s.cases.length === 0) return { hardError: "Suggestion has no cases.", softWarning: null };
    const badAgents = s.agents.filter((a) => !isAllowedAgent(a));
    if (badAgents.length) return { hardError: `Unsupported agent(s): ${badAgents.join(", ")}. Allowed: ${ALLOWED_AGENTS.join(", ")}.`, softWarning: null };
    const badCases = s.cases.filter((c) => !isAllowedCase(c));
    if (badCases.length) return { hardError: `Unsupported case(s): ${badCases.join(", ")}. Allowed: ${ALLOWED_CASES.join(", ")}.`, softWarning: null };
    const total = s.agents.length * s.cases.length;
    if (total === 0) return { hardError: "Suggestion would create 0 runs.", softWarning: null };
    if (total > 500) return { hardError: `Suggestion would create ${total} runs (hard cap is 500). Narrow the agents or cases.`, softWarning: null };
    if (total > 50) return { hardError: null, softWarning: `This suggestion would create ${total} runs (${s.agents.length} agents × ${s.cases.length} cases). That's a large sweep — you can still apply it.` };
    return { hardError: null, softWarning: null };
  };

  const buildDiff = (s: BatchSuggestion): DiffRow[] => {
    const next = {
      name: s.name,
      task: s.task,
      research_question: s.research_question,
      agents: s.agents.join(", "),
      cases: s.cases.join(", "),
    };
    const current = { name, task, research_question: researchQuestion, agents: agentsText, cases: casesText };
    const labels: Record<FieldKey, string> = {
      name: "Batch Name",
      task: "Task",
      research_question: "Research Question",
      agents: "Agents",
      cases: "Cases",
    };
    return (Object.keys(labels) as FieldKey[]).map((key) => ({
      key,
      label: labels[key],
      current: current[key] ?? "",
      next: next[key] ?? "",
      isOverwrite: (current[key] ?? "").trim().length > 0 && current[key] !== next[key],
    }));
  };

  const applySuggestionDirect = (s: BatchSuggestion) => {
    setName(s.name);
    setTask(s.task);
    setResearchQuestion(s.research_question);
    setAgentsText(s.agents.join(", "));
    setCasesText(s.cases.join(", "));
    toast.success("Suggestion applied to form");
  };

  const handleAssistApply = (s: BatchSuggestion) => {
    const { hardError, softWarning: warn } = validateSuggestion(s);
    setValidationError(hardError);
    setSoftWarning(warn);
    if (hardError) {
      toast.error("Suggestion failed validation");
      setPendingSuggestion(s);
      setPendingDiff([]);
      return;
    }
    const diff = buildDiff(s);
    const hasOverwrite = diff.some((d) => d.isOverwrite);
    if (!hasOverwrite) {
      applySuggestionDirect(s);
      setPendingSuggestion(null);
      return;
    }
    setPendingSuggestion(s);
    setPendingDiff(diff);
  };

  const confirmApply = () => {
    if (!pendingSuggestion) return;
    applySuggestionDirect(pendingSuggestion);
    setPendingSuggestion(null);
    setPendingDiff([]);
    setValidationError(null);
    setSoftWarning(null);
  };

  const cancelApply = () => {
    setPendingSuggestion(null);
    setPendingDiff([]);
  };

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

  const showDiffModal = !!pendingSuggestion && pendingDiff.length > 0 && !validationError;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Create Batch Experiment</h1>

      <BatchAssistCard onApply={handleAssistApply} />

      {validationError && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Cannot apply suggestion</AlertTitle>
          <AlertDescription>
            {validationError}{" "}
            <button
              className="ml-1 underline"
              onClick={() => { setValidationError(null); setPendingSuggestion(null); }}
            >
              Dismiss
            </button>
          </AlertDescription>
        </Alert>
      )}

      {softWarning && !validationError && (
        <Alert className="mb-4 border-primary/40 bg-primary/5">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <AlertTitle>Large sweep</AlertTitle>
          <AlertDescription>
            {softWarning}{" "}
            <button className="ml-1 underline" onClick={() => setSoftWarning(null)}>Dismiss</button>
          </AlertDescription>
        </Alert>
      )}

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
              placeholder="e.g. case5, case14, case30"
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
                <PresetGroupedList presets={presets} />
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

      <AlertDialog open={showDiffModal} onOpenChange={(o) => !o && cancelApply()}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Apply AI suggestion?</AlertDialogTitle>
            <AlertDialogDescription>
              Some fields already contain values. Review what will change before applying.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto text-sm">
            {pendingDiff.map((row) => (
              <div key={row.key} className="rounded-md border border-border/60 p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold">{row.label}</span>
                  <span className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${row.isOverwrite ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
                    {row.isOverwrite ? "OVERWRITE" : "NEW"}
                  </span>
                </div>
                {row.isOverwrite && row.current && (
                  <div className="text-xs text-muted-foreground line-through mb-0.5 break-words">{row.current}</div>
                )}
                <div className="text-xs text-foreground break-words">{row.next || <em className="text-muted-foreground">(empty)</em>}</div>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelApply}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApply}>Apply to form</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
