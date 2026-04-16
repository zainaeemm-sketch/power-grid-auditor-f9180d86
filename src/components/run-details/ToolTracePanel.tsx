import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RunStatus } from "@/types/grid-arena";

interface TraceEntry {
  tool_name: string;
  purpose: string;
  input_summary: string;
  output_summary: string;
  status: "done" | "running" | "pending";
  timestamp: string;
}

function generateMockTrace(status: RunStatus): TraceEntry[] {
  const base: TraceEntry[] = [
    { tool_name: "DatasetLoader", purpose: "Load benchmark case", input_summary: "case_file.json", output_summary: "118 buses loaded", status: "done", timestamp: "T+0s" },
    { tool_name: "PromptBuilder", purpose: "Construct agent prompt", input_summary: "template v1", output_summary: "Prompt assembled", status: "done", timestamp: "T+1s" },
  ];
  if (status === "queued") return base.map((e) => ({ ...e, status: "pending" as const }));
  const running: TraceEntry[] = [
    ...base,
    { tool_name: "LLMInvoker", purpose: "Call language model", input_summary: "prompt (2.1k tokens)", output_summary: "Response received", status: status === "running" ? "running" : "done", timestamp: "T+3s" },
    { tool_name: "ResponseParser", purpose: "Parse agent output", input_summary: "raw response", output_summary: "Action extracted", status: status === "running" ? "pending" : "done", timestamp: "T+5s" },
  ];
  if (status === "running") return running;
  return [
    ...running,
    { tool_name: "PowerFlowSolver", purpose: "Run AC power flow", input_summary: "Modified network", output_summary: "Converged in 4 iters", status: "done", timestamp: "T+8s" },
    { tool_name: "ViolationChecker", purpose: "Check constraint violations", input_summary: "Solution vector", output_summary: "0 violations", status: "done", timestamp: "T+9s" },
  ];
}

const statusColor: Record<string, string> = {
  done: "bg-primary/15 text-primary border-primary/30",
  running: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  pending: "bg-muted/50 text-muted-foreground border-border/30",
};

export function ToolTracePanel({ status }: { status: RunStatus }) {
  const entries = generateMockTrace(status);

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader>
        <CardTitle className="text-base">Tool Trace</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {entries.map((e, i) => (
            <div key={i} className="flex items-start gap-3 rounded-md border border-border/30 bg-muted/10 p-3 text-sm">
              <Badge variant="outline" className={`shrink-0 text-[10px] ${statusColor[e.status]}`}>{e.status}</Badge>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{e.tool_name}</p>
                <p className="text-xs text-muted-foreground">{e.purpose}</p>
                <div className="mt-1 flex gap-4 text-xs text-muted-foreground/80">
                  <span>In: {e.input_summary}</span>
                  <span>Out: {e.output_summary}</span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{e.timestamp}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
