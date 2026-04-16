import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const METRICS = [
  { key: "feasibility", label: "Feasibility" },
  { key: "violations_found", label: "Violations Found" },
  { key: "baseline_violations", label: "Baseline Violations" },
  { key: "post_action_violations", label: "Post-Action Violations" },
  { key: "violation_improvement", label: "Improvement" },
  { key: "confidence", label: "Confidence" },
  { key: "grounding_quality", label: "Grounding Quality" },
  { key: "action_applied", label: "Action Applied" },
  { key: "notes", label: "Notes" },
] as const;

export function ResultsSummaryPanel() {
  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader>
        <CardTitle className="text-base">Results Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {METRICS.map((m) => (
            <div key={m.key} className="rounded-lg border border-border/40 p-3 text-center">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <Badge variant="secondary" className="mt-1.5">Pending</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
