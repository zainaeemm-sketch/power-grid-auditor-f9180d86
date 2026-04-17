import type { BatchRunWithEvaluation } from "@/types/grid-arena";

interface GroupStats {
  key: string;
  count: number;
  mean: number;
  variance: number;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string | null | undefined): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = keyFn(item);
    if (!k) continue;
    const arr = map.get(k) ?? [];
    arr.push(item);
    map.set(k, arr);
  }
  return map;
}

function stats(values: number[]): { mean: number; variance: number } {
  if (values.length === 0) return { mean: 0, variance: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return { mean, variance };
}

function aggregate(
  runs: BatchRunWithEvaluation[],
  keyFn: (r: BatchRunWithEvaluation) => string | null | undefined,
): GroupStats[] {
  const groups = groupBy(runs, keyFn);
  return Array.from(groups.entries())
    .map(([key, items]) => {
      const vals = items
        .map((i) => i.evaluation?.violation_improvement)
        .filter((v): v is number => typeof v === "number");
      const { mean, variance } = stats(vals);
      return { key, count: items.length, mean, variance };
    })
    .sort((a, b) => b.mean - a.mean);
}

export function bestModel(runs: BatchRunWithEvaluation[]): GroupStats | null {
  return aggregate(runs, (r) => r.metadata?.model_name)[0] ?? null;
}

export function bestAgent(runs: BatchRunWithEvaluation[]): GroupStats | null {
  return aggregate(runs, (r) => r.run.agent)[0] ?? null;
}

export function bestCase(runs: BatchRunWithEvaluation[]): GroupStats | null {
  return aggregate(runs, (r) => r.run.case_name)[0] ?? null;
}

export function robustnessNotes(runs: BatchRunWithEvaluation[]): {
  highVariance: GroupStats[];
  stable: GroupStats[];
} {
  const all = aggregate(runs, (r) => r.metadata?.model_name);
  const highVariance = all.filter((g) => g.variance > 1 && g.count >= 2);
  const stable = all.filter((g) => g.variance <= 1 && g.count >= 2);
  return { highVariance, stable };
}

export function failureModes(runs: BatchRunWithEvaluation[]): {
  infeasibleCount: number;
  ungroundedCount: number;
  parserFailures: number;
  total: number;
  recurringNotes: Array<{ phrase: string; count: number }>;
} {
  let infeasibleCount = 0;
  let ungroundedCount = 0;
  let parserFailures = 0;
  const phrases = new Map<string, number>();

  for (const r of runs) {
    if (r.evaluation?.feasibility === "infeasible") infeasibleCount++;
    if (r.evaluation?.grounding_quality === "ungrounded") ungroundedCount++;
    const note = r.evaluation?.notes?.trim();
    if (note) {
      const key = note.slice(0, 80).toLowerCase();
      phrases.set(key, (phrases.get(key) ?? 0) + 1);
    }
  }
  const recurringNotes = Array.from(phrases.entries())
    .filter(([, c]) => c >= 2)
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { infeasibleCount, ungroundedCount, parserFailures, total: runs.length, recurringNotes };
}

export function accuracyRate(runs: BatchRunWithEvaluation[]): { total: number; exact: number; rate: number } {
  const gtRuns = runs.filter((r) => (r.evaluation as any)?.evaluation_against_ground_truth);
  const exact = gtRuns.filter((r) => (r.evaluation as any)?.action_match === "exact").length;
  return { total: gtRuns.length, exact, rate: gtRuns.length ? exact / gtRuns.length : 0 };
}

export function avgOptimalityGap(runs: BatchRunWithEvaluation[]): number {
  const vals = runs
    .filter((r) => (r.evaluation as any)?.evaluation_against_ground_truth)
    .map((r) => Number((r.evaluation as any)?.optimality_gap ?? 0));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

export function feasibilityAgreementRate(runs: BatchRunWithEvaluation[]): number {
  const gtRuns = runs.filter((r) => (r.evaluation as any)?.evaluation_against_ground_truth);
  if (!gtRuns.length) return 0;
  const correct = gtRuns.filter((r) => (r.evaluation as any)?.feasibility_match === "correct").length;
  return correct / gtRuns.length;
}

export function agentAccuracyVsGroundTruth(runs: BatchRunWithEvaluation[]): Array<{ agent: string; total: number; exact: number; accuracy: number }> {
  const gtRuns = runs.filter((r) => (r.evaluation as any)?.evaluation_against_ground_truth);
  const groups = groupBy(gtRuns, (r) => r.run.agent);
  return Array.from(groups.entries()).map(([agent, items]) => {
    const exact = items.filter((r) => (r.evaluation as any)?.action_match === "exact").length;
    return { agent, total: items.length, exact, accuracy: items.length ? exact / items.length : 0 };
  }).sort((a, b) => b.accuracy - a.accuracy);
}

export type { GroupStats };
