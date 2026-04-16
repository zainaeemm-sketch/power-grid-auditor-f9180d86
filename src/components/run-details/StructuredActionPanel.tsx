import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RunParseResult } from "@/types/grid-arena";

interface StructuredActionPanelProps {
  parseResult: RunParseResult | null;
}

function describeAction(pr: RunParseResult): { label: string; description: string; variant: "default" | "secondary" } {
  const t = pr.action_type;
  if (!t || t === "none") return { label: "None", description: "No structured action was derived.", variant: "secondary" };
  if (t === "scale_all_loads") return { label: "Scale All Loads", description: `Scale all loads with factor ${pr.value ?? "?"}`, variant: "default" };
  if (t === "set_generator_p_mw") return { label: "Set Generator", description: `Set generator ${pr.target_index ?? "?"} to ${pr.value ?? "?"} MW`, variant: "default" };
  if (t === "line_outage") return { label: "Line Outage", description: `Take line ${pr.target_index ?? "?"} out of service`, variant: "default" };
  return { label: t, description: `Action: ${t}`, variant: "default" };
}

export function StructuredActionPanel({ parseResult }: StructuredActionPanelProps) {
  const action = parseResult ? describeAction(parseResult) : null;

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader>
        <CardTitle className="text-base">Structured Action</CardTitle>
      </CardHeader>
      <CardContent>
        {action ? (
          <div className="flex items-start gap-3">
            <Badge variant={action.variant} className="shrink-0 mt-0.5">{action.label}</Badge>
            <p className="text-sm">{action.description}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No parse result available.</p>
        )}
      </CardContent>
    </Card>
  );
}
