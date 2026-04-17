import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import type { RunMetadata } from "@/types/grid-arena";

interface RunConfigPanelProps {
  metadata: RunMetadata | null;
}

const REQUIRED_FIELDS: Array<{ key: string; label: string }> = [
  { key: "model_name", label: "Model" },
  { key: "system_prompt", label: "System prompt" },
  { key: "temperature", label: "Temperature" },
  { key: "prompt_template_version", label: "Prompt template version" },
  { key: "parser_version", label: "Parser version" },
  { key: "evaluation_logic_version", label: "Evaluation version" },
];

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return String(v);
  return String(v);
}

export function RunConfigPanel({ metadata }: RunConfigPanelProps) {
  const m = (metadata ?? {}) as any;

  const missing = REQUIRED_FIELDS.filter((f) => {
    const v = m[f.key];
    return v === null || v === undefined || v === "";
  });
  const complete = missing.length === 0;

  const rows: Array<[string, unknown]> = [
    ["Provider", m.provider_name],
    ["Base URL", m.provider_base_url],
    ["Model", m.model_name],
    ["Model version", m.model_version],
    ["Prompt template ver.", m.prompt_template_version],
    ["Prompt version", m.prompt_version],
    ["Dataset version", m.dataset_version],
    ["Benchmark case ver.", m.benchmark_case_version],
    ["Temperature", m.temperature],
    ["Max tokens", m.max_tokens],
    ["Top-p", m.top_p],
    ["Seed", m.random_seed],
    ["Parser version", m.parser_version],
    ["Evaluation version", m.evaluation_logic_version],
    ["Executed at", m.execution_timestamp ? new Date(m.execution_timestamp).toLocaleString() : null],
  ];

  return (
    <Card className="border-border/60 bg-card/60 lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Run Configuration Snapshot
        </CardTitle>
        {complete ? (
          <Badge variant="outline" className="border-primary/40 text-primary">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Complete
          </Badge>
        ) : (
          <Badge variant="outline" className="border-amber-500/40 text-amber-500">
            <AlertTriangle className="mr-1 h-3 w-3" /> Partial — {missing.length} missing
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
          {rows.map(([label, val]) => (
            <div key={label} className="flex items-baseline justify-between gap-2 border-b border-border/30 py-1">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="truncate font-mono text-xs" title={String(val ?? "")}>{fmt(val)}</span>
            </div>
          ))}
        </div>
        {m.system_prompt && (
          <div className="mt-3 rounded-md border border-border/30 bg-muted/30 p-2">
            <div className="mb-1 text-xs text-muted-foreground">System prompt</div>
            <pre className="whitespace-pre-wrap text-xs">{m.system_prompt}</pre>
          </div>
        )}
        {!complete && (
          <p className="mt-3 text-xs text-amber-500/80">
            Missing for full reproducibility: {missing.map((f) => f.label).join(", ")}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
