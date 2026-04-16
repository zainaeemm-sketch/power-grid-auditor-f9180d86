import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RunEvaluation } from "@/types/grid-arena";

interface ResultsSummaryPanelProps {
  evaluation: RunEvaluation | null;
}

function badgeVariant(value: string, positives: string[], negatives: string[]): "default" | "secondary" | "destructive" | "outline" {
  if (positives.includes(value)) return "default";
  if (negatives.includes(value)) return "destructive";
  return "secondary";
}

export function ResultsSummaryPanel({ evaluation }: ResultsSummaryPanelProps) {
  if (!evaluation) {
    return (
      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Results Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No evaluation computed yet. Run the LLM pipeline or reparse the recommendation to generate results.</p>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    { label: "Feasibility", value: evaluation.feasibility, badge: true, positives: ["feasible"], negatives: ["infeasible"] },
    { label: "Baseline Violations", value: String(evaluation.baseline_violations), badge: false },
    { label: "Post-Action Violations", value: String(evaluation.post_action_violations), badge: false },
    { label: "Violation Improvement", value: String(evaluation.violation_improvement), badge: false },
    { label: "Violations Found", value: String(evaluation.violations_found), badge: false },
    { label: "Confidence", value: evaluation.confidence, badge: true, positives: ["high"], negatives: ["low"] },
    { label: "Grounding Quality", value: evaluation.grounding_quality, badge: true, positives: ["grounded"], negatives: ["ungrounded"] },
    { label: "Action Applied", value: evaluation.action_applied, badge: false },
    { label: "Notes", value: evaluation.notes ?? "—", badge: false },
  ];

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader>
        <CardTitle className="text-base">Results Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-lg border border-border/40 p-3 text-center">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              {m.badge ? (
                <Badge variant={badgeVariant(m.value, m.positives ?? [], m.negatives ?? [])} className="mt-1.5">
                  {m.value}
                </Badge>
              ) : (
                <p className="mt-1.5 text-sm font-medium">{m.value}</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
