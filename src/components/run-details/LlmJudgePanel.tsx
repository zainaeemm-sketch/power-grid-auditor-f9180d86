import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Gavel, RefreshCw, AlertTriangle, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { getJudgment, judgeRun, type RunLlmJudgment } from "@/server/judge.functions";
import type { RunEvaluation } from "@/types/grid-arena";

interface Props {
  runId: string;
  evaluation: RunEvaluation | null;
}

// Rubric version is fixed by the judge tool schema (submit_judgment v1).
// Bump this when JUDGE_TOOL parameters change in src/server/judge.functions.ts.
const RUBRIC_VERSION = "judge-rubric-v1";



/** Map a per-criterion enum value to a 1–3 score + tone. */
function scoreFor(criterion: "verdict" | "confidence" | "reasoning_quality" | "action_alignment", value: string | null) {
  if (!value) return { score: null as number | null, tone: "bg-muted text-muted-foreground border-border" };
  const map: Record<string, Record<string, { score: number; tone: string }>> = {
    verdict: {
      agree:    { score: 3, tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
      partial:  { score: 2, tone: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
      disagree: { score: 1, tone: "bg-red-500/15 text-red-300 border-red-500/30" },
    },
    confidence: {
      high:   { score: 3, tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
      medium: { score: 2, tone: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
      low:    { score: 1, tone: "bg-red-500/15 text-red-300 border-red-500/30" },
    },
    reasoning_quality: {
      sound:       { score: 3, tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
      flawed:      { score: 2, tone: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
      unsupported: { score: 1, tone: "bg-red-500/15 text-red-300 border-red-500/30" },
    },
    action_alignment: {
      aligned:     { score: 3, tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
      partial:     { score: 2, tone: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
      misaligned:  { score: 1, tone: "bg-red-500/15 text-red-300 border-red-500/30" },
    },
  };
  return map[criterion][value] ?? { score: null, tone: "bg-muted text-muted-foreground border-border" };
}

const CRITERIA: Array<{
  key: "verdict" | "confidence" | "reasoning_quality" | "action_alignment";
  label: string;
  description: string;
}> = [
  { key: "verdict",           label: "Verdict",            description: "Does the agent's recommendation match the simulator's verdict?" },
  { key: "confidence",        label: "Confidence",         description: "How confident is the judge in this assessment?" },
  { key: "reasoning_quality", label: "Reasoning quality",  description: "Is the agent's reasoning physically sound and well-supported?" },
  { key: "action_alignment",  label: "Action alignment",   description: "Does the parsed action match what the recommendation describes?" },
];

function crossCheck(evaluation: RunEvaluation | null, j: RunLlmJudgment | null) {
  if (!evaluation || !j?.verdict) return null;
  const feasible = evaluation.feasibility === "feasible";
  const agree = j.verdict === "agree";
  if (feasible && agree) return { label: "Confirmed", tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
  if (feasible && !agree) return { label: "Simulator only", tone: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
  if (!feasible && agree) return { label: "Judge only", tone: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
  return { label: "Both reject", tone: "bg-red-500/15 text-red-300 border-red-500/30" };
}

function aggregateScore(j: RunLlmJudgment): { sum: number; max: number } {
  let sum = 0;
  let max = 0;
  for (const c of CRITERIA) {
    const s = scoreFor(c.key, (j as any)[c.key] ?? null).score;
    if (s != null) { sum += s; max += 3; }
  }
  return { sum, max };
}

export function LlmJudgePanel({ runId, evaluation }: Props) {
  const get = useServerFn(getJudgment);
  const judge = useServerFn(judgeRun);
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["judgment", runId],
    queryFn: () => get({ data: { runId } }),
  });

  const j = data?.judgment ?? null;
  const cc = crossCheck(evaluation, j);

  const handleJudge = async () => {
    setRunning(true);
    try {
      const res = await judge({ data: { runId } });
      if (res.error) toast.error(res.error);
      else toast.success("Judgment complete");
      qc.invalidateQueries({ queryKey: ["judgment", runId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Judge failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gavel className="h-4 w-4 text-primary" />
            External LLM judge
          </CardTitle>
          <CardDescription>
            Independent OpenAI cross-check of the simulator verdict.
          </CardDescription>
        </div>
        <Button size="sm" variant="outline" disabled={running || !evaluation} onClick={handleJudge}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} />
          {j ? "Re-judge" : "Judge this run"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : !evaluation ? (
          <p className="text-sm text-muted-foreground">Run an evaluation first to enable the judge.</p>
        ) : !j ? (
          <p className="text-sm text-muted-foreground">No judgment yet. Click "Judge this run" to request one.</p>
        ) : j.error ? (
          <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              <div className="font-semibold">Judge unavailable</div>
              <div className="mt-0.5 text-red-200/80">{j.error}</div>
            </div>
          </div>
        ) : (
          <>
            {/* Header chips: rubric version + cross-check + aggregate */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/10 text-primary">
                <ClipboardCheck className="h-3 w-3" />
                Rubric: {RUBRIC_VERSION}
              </Badge>
              {(() => {
                const { sum, max } = aggregateScore(j);
                if (max === 0) return null;
                return (
                  <Badge variant="outline" className="font-mono">
                    Score: {sum}/{max}
                  </Badge>
                );
              })()}
              {cc && (
                <Badge variant="outline" className={cc.tone}>
                  Cross-check: {cc.label}
                </Badge>
              )}
            </div>

            {/* Per-criterion scores */}
            <div className="rounded-md border border-border/60 bg-muted/20">
              <div className="border-b border-border/60 px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                Per-criterion scores
              </div>
              <ul className="divide-y divide-border/40">
                {CRITERIA.map((c) => {
                  const value = (j as any)[c.key] as string | null;
                  const { score, tone } = scoreFor(c.key, value);
                  return (
                    <li key={c.key} className="flex items-start justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground/90">{c.label}</p>
                        <p className="text-[11px] text-muted-foreground">{c.description}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="outline" className={tone}>
                          {value ?? "—"}
                        </Badge>
                        <span className="w-10 text-right font-mono text-xs text-muted-foreground">
                          {score != null ? `${score}/3` : "—/3"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Rationale */}
            {j.critique && (
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  Judge rationale
                </p>
                <p className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm text-foreground/90">
                  {j.critique}
                </p>
              </div>
            )}
            {j.disagreement_reason && (
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  Disagreement reason
                </p>
                <p className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-foreground/90">
                  {j.disagreement_reason}
                </p>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              {j.provider ? `Provider: ${j.provider}` : null}
              {j.provider && j.model ? " · " : null}
              {j.model ? `Model: ${j.model}` : null}
              {(j.provider || j.model) && j.updated_at ? " · " : null}
              {j.updated_at ? `Updated ${new Date(j.updated_at).toLocaleString()}` : null}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
