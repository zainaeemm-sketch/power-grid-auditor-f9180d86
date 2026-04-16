import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Run, RunStatus, RunParseResult } from "@/types/grid-arena";

interface ProvenanceTimelinePanelProps {
  run: Run;
  hasParseResult: boolean;
}

interface TimelineStep {
  label: string;
  status: "done" | "current" | "pending";
}

function buildTimeline(status: RunStatus, hasParseResult: boolean): TimelineStep[] {
  const s = status as string;
  const steps: TimelineStep[] = [
    { label: "Experiment created", status: "done" },
    { label: "Benchmark prepared", status: s === "queued" ? "current" : "done" },
    { label: "Agent configured", status: s === "queued" ? "pending" : "done" },
    { label: "Recommendation parsed", status: hasParseResult ? "done" : (s === "running" ? "current" : "pending") },
    { label: "Research question registered", status: s === "queued" ? "pending" : "done" },
    { label: "Analysis started", status: s === "running" ? "current" : (s === "completed" ? "done" : "pending") },
    { label: "Analysis completed", status: s === "completed" ? "done" : "pending" },
    { label: "Validation completed", status: s === "completed" ? "done" : "pending" },
  ];
  return steps;
}

const dotColor: Record<string, string> = {
  done: "bg-primary",
  current: "bg-blue-400 animate-pulse",
  pending: "bg-muted-foreground/30",
};

const badgeClass: Record<string, string> = {
  done: "bg-primary/15 text-primary border-primary/30",
  current: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  pending: "bg-muted/50 text-muted-foreground border-border/30",
};

export function ProvenanceTimelinePanel({ run, hasParseResult }: ProvenanceTimelinePanelProps) {
  const steps = buildTimeline(run.status as RunStatus, hasParseResult);

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader>
        <CardTitle className="text-base">Provenance Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative ml-3">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-border/50" />
          <div className="space-y-4">
            {steps.map((step, i) => (
              <div key={i} className="relative flex items-center gap-3 pl-5">
                <div className={`absolute left-[-4px] h-2 w-2 rounded-full ${dotColor[step.status]}`} />
                <span className="text-sm flex-1">{step.label}</span>
                <Badge variant="outline" className={`text-[10px] ${badgeClass[step.status]}`}>
                  {step.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
