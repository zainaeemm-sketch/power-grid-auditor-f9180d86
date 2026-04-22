import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { listPresets, createRun } from "@/server/runs.functions";
import { listScenarios } from "@/server/ground-truth.functions";
import { useServerFn } from "@tanstack/react-start";
import type { ExperimentPreset, GroundTruthScenarioListItem } from "@/types/grid-arena";
import { Play } from "lucide-react";
import { Zap } from "lucide-react";
import { PresetSelectItem, PresetGroupedList } from "@/components/PresetSelectItem";
import { ScenarioAssistCard } from "@/components/new-run/ScenarioAssistCard";
import type { ScenarioSuggestion } from "@/server/scenario-assist.functions";

type StressedQuickPick = {
  id: string;
  label: string;
  description: string;
  title: string;
  task: string;
  case_name: string;
  evaluation_mode: "rule_based" | "simulation" | "auto";
};

const STRESSED_QUICK_PICKS: StressedQuickPick[] = [
  {
    id: "case30-overload",
    label: "case30 — branch overload",
    description:
      "case30 with elevated demand on branch 6→8 (rated 16 MW). Baseline overloads expected; agent must redispatch or shed load.",
    title: "case30 branch overload — corrective dispatch",
    task:
      "case30 is operating with branch 6→8 (rated 16 MW) overloaded by ~25% under current dispatch. " +
      "Propose a single corrective action — either redispatch a generator (set_generator_p_mw on gen index 1 or 2), " +
      "scale all loads by 0.90–0.95, or open a parallel branch — to bring all line loadings ≤ 100% of rating.",
    case_name: "case30",
    evaluation_mode: "simulation",
  },
  {
    id: "case14-line-outage",
    label: "case14 — line outage N-1",
    description:
      "case14 with line 6 (bus 3→4) tripped. Forces rerouting through weaker parallel paths; expect overloads.",
    title: "case14 line outage — N-1 contingency",
    task:
      "case14 has just lost line index 6 (bus 3→4) due to an N-1 contingency. The system is post-trip and " +
      "several remaining branches are at or above their thermal rating. Propose a single recovery action — " +
      "scale_all_loads (0.85–0.95), set_generator_p_mw on gens 0 or 1, or further selective line_outage — " +
      "to restore feasibility (all branches ≤ 100% rated).",
    case_name: "case14",
    evaluation_mode: "simulation",
  },
  {
    id: "case5-gen-outage",
    label: "case5 — generator outage",
    description:
      "case5 with generator index 2 tripped offline. Remaining units must pick up the slack; expect overloads on tie lines.",
    title: "case5 generator outage — unit trip recovery",
    task:
      "case5 has just lost generator index 2 (forced outage). Remaining generators must absorb the displaced output and " +
      "at least one branch is now above its thermal rating. Propose a single recovery action — set_generator_p_mw on " +
      "gen index 0 or 1 to redispatch, scale_all_loads (0.85–0.95) to shed demand, or open a congested branch via " +
      "line_outage — to restore feasibility (all branches ≤ 100% rated).",
    case_name: "case5",
    evaluation_mode: "simulation",
  },
  {
    id: "case30-load-spike",
    label: "case30 — peak demand spike",
    description:
      "case30 under a +15% peak load spike across all buses. Generator P_max limits become binding.",
    title: "case30 peak load spike — generation scarcity",
    task:
      "case30 is experiencing a system-wide demand spike (+15% on all loads). Several generators are " +
      "approaching or exceeding their P_max limits and one branch is overloaded. Propose a single action — " +
      "scale_all_loads (0.85–0.92) to shed demand, or set_generator_p_mw to redispatch within limits — " +
      "to eliminate all violations.",
    case_name: "case30",
    evaluation_mode: "simulation",
  },
];

export const Route = createFileRoute("/_authenticated/new-run")({
  head: () => ({
    meta: [
      { title: "New Run — GridArena" },
      { name: "description", content: "Create a new experiment run." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { case?: string } => {
    const c = typeof search.case === "string" ? (search.case as string) : undefined;
    return c ? { case: c } : {};
  },
  loader: async () => {
    if (typeof window === "undefined") return { presets: [], scenarios: [] };
    try {
      const [p, s] = await Promise.all([listPresets(), listScenarios()]);
      return { presets: p.presets, scenarios: s.scenarios };
    } catch {
      return { presets: [], scenarios: [] };
    }
  },
  component: NewRunPage,
});

function NewRunPage() {
  const { presets, scenarios } = Route.useLoaderData() as { presets: ExperimentPreset[]; scenarios: GroundTruthScenarioListItem[] };
  const navigate = useNavigate();
  const createRunFn = useServerFn(createRun);

  const search = Route.useSearch() as { case?: string };
  const [title, setTitle] = useState("");
  const [task, setTask] = useState("");
  const [agent, setAgent] = useState("");
  const [caseName, setCaseName] = useState(search.case ?? "");
  const [researchQuestion, setResearchQuestion] = useState("");
  const [presetId, setPresetId] = useState<string>("");
  const [evaluationMode, setEvaluationMode] = useState<"rule_based" | "simulation" | "auto">("rule_based");
  const [groundTruthId, setGroundTruthId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const [pendingSuggestion, setPendingSuggestion] = useState<ScenarioSuggestion | null>(null);

  type FieldDiff = {
    key: "title" | "task" | "case_name" | "research_question" | "evaluation_mode";
    label: string;
    current: string;
    next: string;
    willOverwrite: boolean;
  };

  const computeDiffs = (s: ScenarioSuggestion): FieldDiff[] => {
    const rows: FieldDiff[] = [
      { key: "title", label: "Title", current: title, next: s.title, willOverwrite: false },
      { key: "task", label: "Task", current: task, next: s.task, willOverwrite: false },
      { key: "case_name", label: "Case", current: caseName, next: s.case_name, willOverwrite: false },
      { key: "research_question", label: "Research question", current: researchQuestion, next: s.research_question, willOverwrite: false },
      { key: "evaluation_mode", label: "Evaluation mode", current: evaluationMode, next: s.evaluation_mode, willOverwrite: false },
    ];
    return rows
      .filter((r) => r.current.trim() !== r.next.trim() || !r.current.trim())
      .map((r) => ({ ...r, willOverwrite: r.current.trim().length > 0 }));
  };

  const writeSuggestion = (s: ScenarioSuggestion) => {
    setTitle(s.title);
    setTask(s.task);
    setCaseName(s.case_name);
    setResearchQuestion(s.research_question);
    setEvaluationMode(s.evaluation_mode);
  };

  const TASK_MIN = 20;
  const TASK_MAX = 1500;

  const validateSuggestion = (s: ScenarioSuggestion): string | null => {
    const taskLen = s.task.trim().length;
    if (taskLen < TASK_MIN) {
      return `Task is too short (${taskLen} chars). Need at least ${TASK_MIN} characters describing the corrective action. Try Regenerate.`;
    }
    if (taskLen > TASK_MAX) {
      return `Task is too long (${taskLen} chars). Maximum is ${TASK_MAX}. Try Regenerate with a tighter prompt.`;
    }
    const text = `${s.task} ${s.title}`.toLowerCase();
    const mentionsSimAction =
      /\b(set_generator_p_mw|scale_all_loads|line_outage|redispatch|power[- ]?flow|overload|contingency|n-?1|trip|outage|p_max|mw\b)/.test(text);
    const looksHeuristic = /\b(rule[- ]?based|heuristic|simple if|threshold)\b/.test(text);
    if (s.evaluation_mode === "rule_based" && mentionsSimAction && !looksHeuristic) {
      return "Evaluation mode is 'rule_based' but the task describes a simulation-grade action (overload/contingency/redispatch). Switch the suggestion to 'simulation' or 'auto', or Regenerate.";
    }
    if (s.evaluation_mode === "simulation" && !mentionsSimAction && looksHeuristic) {
      return "Evaluation mode is 'simulation' but the task reads as a rule-based heuristic with no power-flow signals. Switch to 'rule_based', or Regenerate.";
    }
    return null;
  };

  const [applyError, setApplyError] = useState<string | null>(null);

  const applyAiSuggestion = (s: ScenarioSuggestion) => {
    const err = validateSuggestion(s);
    if (err) {
      setApplyError(err);
      setPendingSuggestion(null);
      return;
    }
    setApplyError(null);
    const anyExisting = [title, task, caseName, researchQuestion].some((v) => v.trim().length > 0);
    if (!anyExisting) {
      writeSuggestion(s);
      return;
    }
    setPendingSuggestion(s);
  };

  const confirmApply = () => {
    if (!pendingSuggestion) return;
    const err = validateSuggestion(pendingSuggestion);
    if (err) {
      setApplyError(err);
      setPendingSuggestion(null);
      return;
    }
    writeSuggestion(pendingSuggestion);
    setPendingSuggestion(null);
  };

  const pendingDiffs = pendingSuggestion ? computeDiffs(pendingSuggestion) : [];
  const overwriteCount = pendingDiffs.filter((d) => d.willOverwrite).length;
  const newCount = pendingDiffs.length - overwriteCount;

  const applyStressedQuickPick = (pick: StressedQuickPick) => {
    setTitle(pick.title);
    setTask(pick.task);
    setCaseName(pick.case_name);
    setEvaluationMode(pick.evaluation_mode);
    if (!researchQuestion) {
      setResearchQuestion(
        "Does the agent select an action that resolves the seeded violations without introducing new ones?",
      );
    }
  };

  const handlePresetChange = (value: string) => {
    setPresetId(value === "none" ? "" : value);
    if (value !== "none") {
      const preset = presets.find((p: ExperimentPreset) => p.id === value);
      if (preset) {
        setAgent(preset.model_name || "");
        const presetMode = (preset as any).evaluation_mode;
        if (presetMode === "rule_based" || presetMode === "simulation" || presetMode === "auto") {
          setEvaluationMode(presetMode);
        }
        // Auto-fill case_name + title from matching built-in stressed preset
        const stressed = STRESSED_QUICK_PICKS.find(
          (pick) => preset.name === `[Stressed] ${pick.label}`,
        );
        if (stressed) {
          setTitle(stressed.title);
          setTask(stressed.task);
          setCaseName(stressed.case_name);
          if (!researchQuestion) {
            setResearchQuestion(
              "Does the agent select an action that resolves the seeded violations without introducing new ones?",
            );
          }
        }
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
          evaluation_mode: evaluationMode,
          ground_truth_scenario_id: groundTruthId || null,
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
        <ScenarioAssistCard onApply={applyAiSuggestion} />

        {applyError && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive animate-fade-up"
          >
            <div className="mb-1 font-semibold">Suggestion can't be applied</div>
            <div className="text-destructive/90">{applyError}</div>
            <button
              type="button"
              onClick={() => setApplyError(null)}
              className="mt-2 text-[10px] uppercase tracking-wide text-destructive/70 underline hover:text-destructive"
            >
              Dismiss
            </button>
          </div>
        )}

        <Card className="mb-4 border-amber-500/30 bg-amber-500/5 animate-fade-up" style={{ animationDelay: "50ms" }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <Zap className="h-4 w-4 text-amber-400" />
              Stressed scenarios — quick-pick
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              Pre-fill the form with a case + contingency known to produce non-zero baseline violations,
              so counterfactual graphs and optimality-gap metrics show real signal.
            </p>
            <div className="grid gap-2 md:grid-cols-3">
              {STRESSED_QUICK_PICKS.map((pick) => (
                <button
                  key={pick.id}
                  type="button"
                  onClick={() => applyStressedQuickPick(pick)}
                  className="rounded-md border border-border/60 bg-background/50 p-3 text-left text-xs transition hover:border-amber-400/60 hover:bg-amber-500/10"
                >
                  <div className="mb-1 font-semibold text-foreground">{pick.label}</div>
                  <div className="text-muted-foreground">{pick.description}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

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
                  <PresetGroupedList presets={presets} />
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

            <div className="space-y-2">
              <Label>Evaluation Mode</Label>
              <Select value={evaluationMode} onValueChange={(v) => setEvaluationMode(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rule_based">Rule-based (deterministic heuristic)</SelectItem>
                  <SelectItem value="simulation">Simulation-based (DC PF / pandapower)</SelectItem>
                  <SelectItem value="auto">Auto (simulation → rule-based fallback)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Simulation uses the external pandapower service if configured, then falls back to an in-Worker DC power-flow solver for built-in IEEE cases (case5, case14, case30).</p>
            </div>

            <div className="space-y-2">
              <Label>Ground Truth Scenario (optional)</Label>
              <Select value={groundTruthId || "none"} onValueChange={(v) => setGroundTruthId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="No ground truth" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No ground truth</SelectItem>
                  {scenarios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.scenario_id} — {s.case_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Link to a reference scenario to enable accuracy and optimality-gap metrics.</p>
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

      <AlertDialog open={pendingSuggestion !== null} onOpenChange={(open) => { if (!open) setPendingSuggestion(null); }}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Apply AI suggestion to form?</AlertDialogTitle>
            <AlertDialogDescription>
              {overwriteCount > 0 ? (
                <>
                  <span className="font-semibold text-foreground">{overwriteCount}</span> field{overwriteCount === 1 ? "" : "s"} will be overwritten
                  {newCount > 0 ? <> and <span className="font-semibold text-foreground">{newCount}</span> new field{newCount === 1 ? "" : "s"} filled.</> : "."}
                </>
              ) : (
                <>{pendingDiffs.length} field{pendingDiffs.length === 1 ? "" : "s"} will be filled. No existing values will be lost.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-[50vh] overflow-y-auto space-y-3 text-xs">
            {pendingDiffs.map((d) => (
              <div key={d.key} className="rounded-md border border-border/50 bg-muted/30 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-semibold text-foreground text-sm">{d.label}</span>
                  {d.willOverwrite ? (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">OVERWRITE</span>
                  ) : (
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">NEW</span>
                  )}
                </div>
                {d.willOverwrite && (
                  <div className="mb-2">
                    <div className="text-muted-foreground font-medium mb-0.5">Current</div>
                    <div className="rounded bg-background/50 p-2 text-foreground/70 line-through whitespace-pre-wrap break-words">
                      {d.current.length > 240 ? d.current.slice(0, 240) + "…" : d.current}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-muted-foreground font-medium mb-0.5">New</div>
                  <div className="rounded bg-primary/5 border border-primary/20 p-2 text-foreground whitespace-pre-wrap break-words">
                    {d.next.length > 240 ? d.next.slice(0, 240) + "…" : d.next}
                  </div>
                </div>
              </div>
            ))}
            {pendingDiffs.length === 0 && (
              <div className="rounded-md border border-border/50 bg-muted/30 p-3 text-muted-foreground">
                The suggestion matches your current form values. Nothing will change.
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApply} disabled={pendingDiffs.length === 0}>
              Apply {pendingDiffs.length > 0 ? `${pendingDiffs.length} change${pendingDiffs.length === 1 ? "" : "s"}` : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
