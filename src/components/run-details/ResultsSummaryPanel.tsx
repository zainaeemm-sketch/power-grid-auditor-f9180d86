import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Cpu } from "lucide-react";
import type { RunEvaluation } from "@/types/grid-arena";

interface ResultsSummaryPanelProps {
  evaluation: RunEvaluation | null;
}

function badgeVariant(value: string, positives: string[], negatives: string[]): "default" | "secondary" | "destructive" | "outline" {
  if (positives.includes(value)) return "default";
  if (negatives.includes(value)) return "destructive";
  return "secondary";
}

function engineLabel(engine: string | null | undefined): { label: string; cls: string } {
  if (engine === "pandapower") return { label: "pandapower", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
  if (engine === "dc_powerflow") return { label: "DC power flow", cls: "bg-sky-500/15 text-sky-400 border-sky-500/30" };
  return { label: "rule-based", cls: "bg-muted text-muted-foreground border-border/40" };
}

export function ResultsSummaryPanel({ evaluation }: ResultsSummaryPanelProps) {
  const [expanded, setExpanded] = useState(false);

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

  const engine = engineLabel(evaluation.engine_used);
  const details = evaluation.simulation_details;
  const hasDetails = !!details && (
    (details.line_loadings && details.line_loadings.length > 0) ||
    (details.voltage_violations && details.voltage_violations.length > 0) ||
    (details.generator_violations && details.generator_violations.length > 0)
  );

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Results Summary</CardTitle>
        <Badge variant="outline" className={`gap-1 ${engine.cls}`}>
          <Cpu className="h-3 w-3" />
          Engine: {engine.label}
        </Badge>
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

        {hasDetails && (
          <div className="mt-4 rounded-lg border border-border/40 bg-muted/20 p-3">
            <Button variant="ghost" size="sm" className="w-full justify-between" onClick={() => setExpanded((v) => !v)}>
              <span className="text-sm font-medium">Simulation Details</span>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            {expanded && (
              <div className="mt-3 space-y-4 text-xs">
                {details!.line_loadings && details!.line_loadings.length > 0 && (
                  <div>
                    <p className="mb-1.5 font-semibold uppercase tracking-wide text-muted-foreground">Line Loadings</p>
                    <div className="grid grid-cols-1 gap-1 font-mono sm:grid-cols-2">
                      {details!.line_loadings!.map((l) => (
                        <div key={l.branch_index} className={`flex justify-between rounded border border-border/30 px-2 py-1 ${l.overloaded ? "bg-destructive/10 text-destructive" : ""}`}>
                          <span>L{l.branch_index} ({l.from_bus}→{l.to_bus})</span>
                          <span>{l.flow_mw} MW · {l.loading_pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {details!.generator_violations && details!.generator_violations.length > 0 && (
                  <div>
                    <p className="mb-1.5 font-semibold uppercase tracking-wide text-muted-foreground">Generator Violations</p>
                    <ul className="font-mono">
                      {details!.generator_violations!.map((g) => (
                        <li key={g.generator_index} className="text-destructive">G{g.generator_index} @ bus {g.bus}: {g.p_mw} MW ({g.type})</li>
                      ))}
                    </ul>
                  </div>
                )}
                {details!.voltage_violations && details!.voltage_violations.length > 0 && (
                  <div>
                    <p className="mb-1.5 font-semibold uppercase tracking-wide text-muted-foreground">Voltage Violations</p>
                    <ul className="font-mono">
                      {details!.voltage_violations!.map((v) => (
                        <li key={v.bus_index} className="text-destructive">Bus {v.bus_index}: {v.vm_pu} pu ({v.type})</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
