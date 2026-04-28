import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { Activity, GitBranch, Plus, Loader2, X } from "lucide-react";
import { listCounterfactuals } from "@/server/counterfactual.functions";
import { listPerturbationTests } from "@/server/perturbation.functions";
import { classifyCounterfactual, classifyPerturbation } from "@/lib/simulation-skip";
import type { Run } from "@/types/grid-arena";

interface Props {
  runs: Run[];
  initialRunIds?: string[];
}

interface RunAggregate {
  runId: string;
  label: string;
  // Perturbation
  pertTotal: number;
  pertStable: number;
  pertDegraded: number;
  pertFailed: number;
  pertSkipped: number;
  avgViolationChange: number; // mean Δ violations (perturbed − baseline)
  worstViolationChange: number;
  // Counterfactual
  cfTotal: number;
  avgDecisionRegret: number;
  avgOptimalityGap: number;
  cfImproved: number;
  cfUnchanged: number;
  cfWorsened: number;
  // Failure modes (string -> count) across both layers
  failureModes: Record<string, number>;
}

const STABILITY_COLORS = {
  stable: "hsl(150 70% 50%)",
  degraded: "hsl(40 90% 55%)",
  failed: "hsl(0 75% 60%)",
  skipped: "hsl(220 10% 55%)",
};

const FEASIBILITY_COLORS = {
  improved: "hsl(150 70% 50%)",
  unchanged: "hsl(220 10% 55%)",
  worsened: "hsl(0 75% 60%)",
};

function shortLabel(r: Run): string {
  const t = r.title?.trim() || r.case_name || r.id.slice(0, 8);
  return t.length > 22 ? `${t.slice(0, 21)}…` : t;
}

function bucketFailureReason(reason: string | null | undefined): string {
  if (!reason) return "other";
  const s = reason.toLowerCase();
  if (/no simulator|not available|skipped/.test(s)) return "no simulator";
  if (/timeout|timed out/.test(s)) return "timeout";
  if (/converge|diverge|infeasible solver/.test(s)) return "non-convergence";
  if (/parse|invalid action|unknown action/.test(s)) return "invalid action";
  if (/external|service|http|fetch/.test(s)) return "external service";
  return "other";
}

async function loadAggregate(run: Run): Promise<RunAggregate> {
  const [cfRes, pertRes] = await Promise.all([
    listCounterfactuals({ data: { runId: run.id } }).catch(() => ({ items: [] })),
    listPerturbationTests({ data: { runId: run.id } }).catch(() => ({ items: [] })),
  ]);

  const agg: RunAggregate = {
    runId: run.id,
    label: shortLabel(run),
    pertTotal: 0, pertStable: 0, pertDegraded: 0, pertFailed: 0, pertSkipped: 0,
    avgViolationChange: 0, worstViolationChange: 0,
    cfTotal: 0, avgDecisionRegret: 0, avgOptimalityGap: 0,
    cfImproved: 0, cfUnchanged: 0, cfWorsened: 0,
    failureModes: {},
  };

  let pertSumDelta = 0;
  let pertWithDelta = 0;
  let pertWorst = 0;
  for (const { result } of pertRes.items ?? []) {
    if (!result) continue;
    agg.pertTotal += 1;
    const kind = classifyPerturbation(result.failure_reason, result.notes);
    if (kind === "skipped") {
      agg.pertSkipped += 1;
      const m = bucketFailureReason(result.failure_reason ?? result.notes);
      agg.failureModes[m] = (agg.failureModes[m] ?? 0) + 1;
      continue;
    }
    if (kind === "failed") {
      agg.pertFailed += 1;
      const m = bucketFailureReason(result.failure_reason);
      agg.failureModes[m] = (agg.failureModes[m] ?? 0) + 1;
      continue;
    }
    // success — bucket by robustness_result
    if (result.robustness_result === "stable") agg.pertStable += 1;
    else if (result.robustness_result === "degraded") agg.pertDegraded += 1;
    else if (result.robustness_result === "failed") agg.pertFailed += 1;

    pertSumDelta += result.violation_change;
    pertWithDelta += 1;
    if (Math.abs(result.violation_change) > Math.abs(pertWorst)) pertWorst = result.violation_change;
  }
  agg.avgViolationChange = pertWithDelta ? +(pertSumDelta / pertWithDelta).toFixed(2) : 0;
  agg.worstViolationChange = pertWorst;

  let cfRegretSum = 0;
  let cfGapSum = 0;
  let cfN = 0;
  for (const { result } of cfRes.items ?? []) {
    if (!result) continue;
    agg.cfTotal += 1;
    const kind = classifyCounterfactual(result.status, result.failure_reason);
    if (kind !== "success") {
      const m = bucketFailureReason(result.failure_reason);
      agg.failureModes[m] = (agg.failureModes[m] ?? 0) + 1;
      continue;
    }
    cfRegretSum += Number(result.decision_regret) || 0;
    cfGapSum += Number(result.optimality_gap) || 0;
    cfN += 1;
    if (result.feasibility_change === "improved") agg.cfImproved += 1;
    else if (result.feasibility_change === "worsened") agg.cfWorsened += 1;
    else agg.cfUnchanged += 1;
  }
  agg.avgDecisionRegret = cfN ? +(cfRegretSum / cfN).toFixed(3) : 0;
  agg.avgOptimalityGap = cfN ? +(cfGapSum / cfN).toFixed(3) : 0;

  return agg;
}

export function MultiRunComparisonCharts({ runs, initialRunIds = [] }: Props) {
  const [selected, setSelected] = useState<string[]>(initialRunIds.filter(Boolean));
  const [aggregates, setAggregates] = useState<Record<string, RunAggregate>>({});
  const [loading, setLoading] = useState(false);

  const runById = useMemo(() => Object.fromEntries(runs.map((r) => [r.id, r])), [runs]);

  // Sync initialRunIds when parent selectors change.
  useEffect(() => {
    const next = initialRunIds.filter(Boolean);
    if (next.length === 0) return;
    setSelected((prev) => {
      const merged = Array.from(new Set([...prev, ...next]));
      return merged;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRunIds.join(",")]);

  // Load aggregates for any selected run we don't have yet.
  useEffect(() => {
    const missing = selected.filter((id) => !aggregates[id] && runById[id]);
    if (missing.length === 0) return;
    setLoading(true);
    Promise.all(missing.map((id) => loadAggregate(runById[id])))
      .then((results) => {
        setAggregates((prev) => {
          const next = { ...prev };
          for (const r of results) next[r.runId] = r;
          return next;
        });
      })
      .finally(() => setLoading(false));
  }, [selected, runById, aggregates]);

  const rows = selected.map((id) => aggregates[id]).filter(Boolean) as RunAggregate[];

  const stabilityData = rows.map((r) => ({
    run: r.label,
    stable: r.pertStable,
    degraded: r.pertDegraded,
    failed: r.pertFailed,
    skipped: r.pertSkipped,
  }));

  const deltaData = rows.map((r) => ({
    run: r.label,
    "avg Δ violations": r.avgViolationChange,
    "worst Δ violations": r.worstViolationChange,
    "avg decision regret": r.avgDecisionRegret,
  }));

  // Failure-mode chart — union of all keys across selected runs.
  const failureKeys = Array.from(
    new Set(rows.flatMap((r) => Object.keys(r.failureModes))),
  );
  const failureData = rows.map((r) => {
    const row: Record<string, string | number> = { run: r.label };
    for (const k of failureKeys) row[k] = r.failureModes[k] ?? 0;
    return row;
  });

  const feasibilityData = rows.map((r) => ({
    run: r.label,
    improved: r.cfImproved,
    unchanged: r.cfUnchanged,
    worsened: r.cfWorsened,
  }));

  const stabilityConfig: ChartConfig = {
    stable: { label: "Stable", color: STABILITY_COLORS.stable },
    degraded: { label: "Degraded", color: STABILITY_COLORS.degraded },
    failed: { label: "Failed", color: STABILITY_COLORS.failed },
    skipped: { label: "Skipped", color: STABILITY_COLORS.skipped },
  };
  const deltaConfig: ChartConfig = {
    "avg Δ violations": { label: "Avg Δ violations", color: "hsl(40 90% 55%)" },
    "worst Δ violations": { label: "Worst Δ violations", color: "hsl(0 75% 60%)" },
    "avg decision regret": { label: "Avg decision regret", color: "hsl(280 60% 60%)" },
  };
  const feasibilityConfig: ChartConfig = {
    improved: { label: "Improved", color: FEASIBILITY_COLORS.improved },
    unchanged: { label: "Unchanged", color: FEASIBILITY_COLORS.unchanged },
    worsened: { label: "Worsened", color: FEASIBILITY_COLORS.worsened },
  };
  const failureConfig: ChartConfig = Object.fromEntries(
    failureKeys.map((k, i) => [k, { label: k, color: `hsl(${(i * 47) % 360} 65% 55%)` }]),
  ) as ChartConfig;

  return (
    <Card className="border-border/40 bg-card/60">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <Activity className="h-4 w-4 text-primary" />
            Multi-run robustness & counterfactual charts
          </CardTitle>
          <CardDescription>
            Compare perturbation stability, deltas, and counterfactual outcomes across any number of runs.
          </CardDescription>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add runs ({selected.length})
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <ScrollArea className="h-72">
              <ul className="p-2">
                {runs.map((r) => {
                  const checked = selected.includes(r.id);
                  return (
                    <li key={r.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent/40">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => {
                            setSelected((prev) =>
                              c ? Array.from(new Set([...prev, r.id])) : prev.filter((id) => id !== r.id),
                            );
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {r.title} <span className="text-muted-foreground">— {r.agent}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Selected chips */}
        <div className="flex flex-wrap gap-1.5">
          {selected.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Select two or more runs to compare counterfactual and perturbation outcomes.
            </p>
          )}
          {selected.map((id) => {
            const r = runById[id];
            if (!r) return null;
            return (
              <Badge key={id} variant="outline" className="gap-1 pl-2 pr-1">
                {shortLabel(r)}
                <button
                  type="button"
                  className="ml-0.5 rounded p-0.5 hover:bg-accent/60"
                  onClick={() => setSelected((prev) => prev.filter((x) => x !== id))}
                  aria-label={`Remove ${r.title}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>

        {loading && rows.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading run aggregates…
          </p>
        )}

        {rows.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Perturbation stability */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Perturbation stability mix
              </p>
              <ChartContainer config={stabilityConfig} className="h-[240px] w-full">
                <BarChart data={stabilityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="run" fontSize={10} angle={-15} textAnchor="end" height={50} />
                  <YAxis fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="stable" stackId="s" fill={STABILITY_COLORS.stable} />
                  <Bar dataKey="degraded" stackId="s" fill={STABILITY_COLORS.degraded} />
                  <Bar dataKey="failed" stackId="s" fill={STABILITY_COLORS.failed} />
                  <Bar dataKey="skipped" stackId="s" fill={STABILITY_COLORS.skipped} />
                </BarChart>
              </ChartContainer>
            </div>

            {/* Deltas + regret */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Average / worst deltas & decision regret
              </p>
              <ChartContainer config={deltaConfig} className="h-[240px] w-full">
                <BarChart data={deltaData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="run" fontSize={10} angle={-15} textAnchor="end" height={50} />
                  <YAxis fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="avg Δ violations" fill="hsl(40 90% 55%)" />
                  <Bar dataKey="worst Δ violations" fill="hsl(0 75% 60%)" />
                  <Bar dataKey="avg decision regret" fill="hsl(280 60% 60%)" />
                </BarChart>
              </ChartContainer>
            </div>

            {/* Counterfactual feasibility change */}
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <GitBranch className="h-3 w-3" />
                Counterfactual feasibility change
              </p>
              <ChartContainer config={feasibilityConfig} className="h-[240px] w-full">
                <BarChart data={feasibilityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="run" fontSize={10} angle={-15} textAnchor="end" height={50} />
                  <YAxis fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="improved" stackId="f" fill={FEASIBILITY_COLORS.improved} />
                  <Bar dataKey="unchanged" stackId="f" fill={FEASIBILITY_COLORS.unchanged} />
                  <Bar dataKey="worsened" stackId="f" fill={FEASIBILITY_COLORS.worsened} />
                </BarChart>
              </ChartContainer>
            </div>

            {/* Failure modes */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Failure modes (perturbation + counterfactual)
              </p>
              {failureKeys.length === 0 ? (
                <p className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
                  No failures recorded across selected runs.
                </p>
              ) : (
                <ChartContainer config={failureConfig} className="h-[240px] w-full">
                  <BarChart data={failureData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="run" fontSize={10} angle={-15} textAnchor="end" height={50} />
                    <YAxis fontSize={11} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {failureKeys.map((k, i) => (
                      <Bar key={k} dataKey={k} stackId="m" fill={`hsl(${(i * 47) % 360} 65% 55%)`} />
                    ))}
                  </BarChart>
                </ChartContainer>
              )}
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto rounded border border-border/40">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 text-left text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">Run</th>
                  <th className="px-2 py-1.5"># pert</th>
                  <th className="px-2 py-1.5">stable / degraded / failed</th>
                  <th className="px-2 py-1.5">avg Δ viol</th>
                  <th className="px-2 py-1.5">worst Δ</th>
                  <th className="px-2 py-1.5"># cf</th>
                  <th className="px-2 py-1.5">avg regret</th>
                  <th className="px-2 py-1.5">avg gap</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.runId} className="border-t border-border/40">
                    <td className="px-2 py-1.5 font-medium">{r.label}</td>
                    <td className="px-2 py-1.5 font-mono">{r.pertTotal}</td>
                    <td className="px-2 py-1.5 font-mono">
                      {r.pertStable} / {r.pertDegraded} / {r.pertFailed}
                    </td>
                    <td className="px-2 py-1.5 font-mono">{r.avgViolationChange}</td>
                    <td className="px-2 py-1.5 font-mono">{r.worstViolationChange}</td>
                    <td className="px-2 py-1.5 font-mono">{r.cfTotal}</td>
                    <td className="px-2 py-1.5 font-mono">{r.avgDecisionRegret}</td>
                    <td className="px-2 py-1.5 font-mono">{r.avgOptimalityGap}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
