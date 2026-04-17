import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import type { GroundTruthAction, GroundTruthScenario, RunEvaluation, RunParseResult } from "@/types/grid-arena";

interface Props {
  scenario: GroundTruthScenario | null;
  referenceActions: GroundTruthAction[];
  evaluation: RunEvaluation | null;
  parseResult: RunParseResult | null;
}

function matchBadge(match: string | null | undefined) {
  if (match === "exact") return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle2 className="mr-1 h-3 w-3" />Exact</Badge>;
  if (match === "partial") return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30"><MinusCircle className="mr-1 h-3 w-3" />Partial</Badge>;
  return <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30"><XCircle className="mr-1 h-3 w-3" />None</Badge>;
}

function feasBadge(match: string | null | undefined) {
  if (match === "correct") return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle2 className="mr-1 h-3 w-3" />Correct</Badge>;
  return <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30"><XCircle className="mr-1 h-3 w-3" />Incorrect</Badge>;
}

export function GroundTruthComparisonPanel({ scenario, referenceActions, evaluation, parseResult }: Props) {
  const hasGT = !!evaluation?.evaluation_against_ground_truth;

  return (
    <Card className="border-border/40 bg-card/60 lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <Target className="h-4 w-4 text-primary" />
          Ground Truth Comparison
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!hasGT || !scenario ? (
          <p className="text-muted-foreground">No ground truth available.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{scenario.scenario_id}</span>
              <Badge variant="outline" className="text-xs">{scenario.difficulty_level}</Badge>
              <span className="text-muted-foreground">— {scenario.scenario_description}</span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-md border border-border/40 bg-background/40 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reference Action{referenceActions.length > 1 ? "s" : ""}</div>
                {referenceActions.length === 0 ? (
                  <p className="text-muted-foreground">—</p>
                ) : (
                  <ul className="space-y-2">
                    {referenceActions.map((a) => (
                      <li key={a.id} className="text-xs">
                        <div><span className="text-muted-foreground">type:</span> <span className="font-mono">{a.action_type}</span></div>
                        <div><span className="text-muted-foreground">target_index:</span> <span className="font-mono">{a.target_index ?? "—"}</span></div>
                        <div><span className="text-muted-foreground">value:</span> <span className="font-mono">{a.value ?? "—"}</span></div>
                        <div><span className="text-muted-foreground">expected_improvement:</span> <span className="font-mono">{String(a.expected_violation_improvement)}</span></div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-md border border-border/40 bg-background/40 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agent Action</div>
                <div className="text-xs">
                  <div><span className="text-muted-foreground">type:</span> <span className="font-mono">{parseResult?.action_type ?? "—"}</span></div>
                  <div><span className="text-muted-foreground">target_index:</span> <span className="font-mono">{parseResult?.target_index ?? "—"}</span></div>
                  <div><span className="text-muted-foreground">value:</span> <span className="font-mono">{parseResult?.value ?? "—"}</span></div>
                  <div><span className="text-muted-foreground">improvement:</span> <span className="font-mono">{String(evaluation?.violation_improvement ?? "—")}</span></div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Action Match:</span>
                {matchBadge(evaluation?.action_match)}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Feasibility Match:</span>
                {feasBadge(evaluation?.feasibility_match)}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Optimality Gap:</span>
                <span className="font-mono text-xs">{evaluation?.optimality_gap != null ? Number(evaluation.optimality_gap).toFixed(2) : "—"}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
