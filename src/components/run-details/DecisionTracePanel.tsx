import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Download, AlertTriangle, ChevronDown, Sparkles, RefreshCw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getRunTraces, explainTrace } from "@/server/trace.functions";
import type { DecisionTrace, StageType } from "@/types/trace";
import type { RunEvaluation } from "@/types/grid-arena";
import { summarizeTrace, classifyFailure } from "@/lib/trace-explainer";
import { exportTraceCsv } from "@/lib/trace-export";

const STAGE_COLORS: Record<StageType, string> = {
  retrieval: "bg-sky-500",
  planning: "bg-violet-500",
  tool_use: "bg-blue-500",
  reasoning: "bg-indigo-500",
  validation: "bg-amber-500",
  execution: "bg-cyan-500",
  evaluation: "bg-emerald-500",
};

const STATUS_BADGE: Record<string, string> = {
  success: "bg-primary/15 text-primary border-primary/30",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  failure: "bg-destructive/15 text-destructive border-destructive/30",
};

export function DecisionTracePanel({
  runId,
  evaluation,
}: {
  runId: string;
  evaluation: RunEvaluation | null;
}) {
  const fetchFn = useServerFn(getRunTraces);
  const explainFn = useServerFn(explainTrace);
  const [traces, setTraces] = useState<DecisionTrace[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explanationSource, setExplanationSource] = useState<"llm" | "fallback" | null>(null);
  const [explanationModel, setExplanationModel] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);

  const loadExplanation = (currentTraces: DecisionTrace[]) => {
    setExplaining(true);
    setExplanation(summarizeTrace(currentTraces, evaluation));
    setExplanationSource("fallback");
    setExplanationModel(null);
    explainFn({ data: { runId } })
      .then((res) => {
        setExplanation(res.explanation);
        setExplanationSource(res.source);
        setExplanationModel(res.model ?? null);
      })
      .catch(() => {})
      .finally(() => setExplaining(false));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchFn({ data: { runId } })
      .then((res: { traces: DecisionTrace[] }) => {
        if (!cancelled) {
          setTraces(res.traces);
          if (res.traces.length > 0) loadExplanation(res.traces);
        }
      })
      .catch(() => {
        if (!cancelled) setTraces([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runId, fetchFn]);

  if (loading) {
    return (
      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Decision Trace</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading trace…</p>
        </CardContent>
      </Card>
    );
  }

  if (!traces || traces.length === 0) {
    return (
      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Decision Trace</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No trace data available yet. Run this experiment (or re-run with the same configuration)
            to capture the decision pipeline.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalMs = Math.max(1, traces.reduce((a, t) => a + t.execution_time_ms, 0));
  const failure = traces.find((t) => t.status === "failure");
  const failureInfo = failure ? classifyFailure(failure.stage_type, failure.failure_reason) : null;

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Decision Trace</CardTitle>
        <Button variant="outline" size="sm" onClick={() => exportTraceCsv(runId, traces)}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export Trace CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-border/40 bg-muted/10 p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Decision Explanation
            </p>
            <div className="flex items-center gap-2">
              {explanationSource && (
                <Badge variant="outline" className="text-[10px]">
                  {explanationSource === "llm" ? (
                    <><Sparkles className="mr-1 h-3 w-3" /> AI</>
                  ) : (
                    "Template"
                  )}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                disabled={explaining}
                onClick={() => loadExplanation(traces)}
              >
                <RefreshCw className={`mr-1 h-3 w-3 ${explaining ? "animate-spin" : ""}`} />
                Regenerate
              </Button>
            </div>
          </div>
          <p className="text-sm leading-relaxed">
            {explanation ?? "Generating explanation…"}
          </p>
        </div>

        {failure && failureInfo && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{failureInfo.type}</AlertTitle>
            <AlertDescription>
              <p className="font-medium">Stage: {failure.stage_name}</p>
              <p className="mt-1 text-sm">{failure.failure_reason ?? "Unknown reason"}</p>
              <p className="mt-2 text-sm opacity-80">Suggestion: {failureInfo.suggestion}</p>
            </AlertDescription>
          </Alert>
        )}

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Timeline
          </p>
          <div className="flex h-3 w-full overflow-hidden rounded-md border border-border/40 bg-muted/20">
            {traces.map((t) => {
              const w = Math.max(2, (t.execution_time_ms / totalMs) * 100);
              const color = t.status === "failure"
                ? "bg-destructive"
                : t.status === "warning"
                  ? "bg-amber-500"
                  : STAGE_COLORS[t.stage_type];
              return (
                <div
                  key={t.id}
                  className={color}
                  style={{ width: `${w}%` }}
                  title={`${t.stage_name} · ${t.execution_time_ms}ms`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
            {(Object.keys(STAGE_COLORS) as StageType[]).map((k) => (
              <div key={k} className="flex items-center gap-1">
                <span className={`inline-block h-2 w-2 rounded-sm ${STAGE_COLORS[k]}`} />
                <span>{k}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {traces.map((t) => (
            <div
              key={t.id}
              className="rounded-md border border-border/30 bg-muted/10 p-3 text-sm"
            >
              <div className="flex flex-wrap items-start gap-2">
                <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[t.status]}`}>
                  {t.status}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {t.stage_type}
                </Badge>
                <span className="font-medium">{t.stage_name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {t.execution_time_ms} ms
                </span>
              </div>
              {(t.input_summary || t.output_summary || t.tool_name) && (
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground/90">
                  {t.tool_name && <div>Tool: <span className="font-mono">{t.tool_name}</span></div>}
                  {t.input_summary && <div>In: {t.input_summary}</div>}
                  {t.output_summary && <div>Out: {t.output_summary}</div>}
                </div>
              )}
              {t.failure_reason && (
                <div className="mt-2 text-xs text-destructive">Reason: {t.failure_reason}</div>
              )}
              {t.evidence != null && (
                <Collapsible className="mt-2">
                  <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <ChevronDown className="h-3 w-3" />
                    Evidence
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <pre className="mt-1 max-h-64 overflow-auto rounded border border-border/30 bg-background/40 p-2 text-[11px] leading-snug">
                      {JSON.stringify(t.evidence, null, 2)}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
