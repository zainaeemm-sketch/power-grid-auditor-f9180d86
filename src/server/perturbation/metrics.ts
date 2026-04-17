import type { FeasibilityStability, RobustnessResult } from "./types";

export function computeFeasibilityStability(
  baseline: string,
  perturbed: string,
): FeasibilityStability {
  const wasFeasible = baseline === "feasible";
  const isFeasible = perturbed === "feasible";
  if (wasFeasible && !isFeasible) return "lost";
  if (!wasFeasible && isFeasible) return "gained";
  return "unchanged";
}

export function computeRobustnessResult(
  violationChange: number,
  stability: FeasibilityStability,
): RobustnessResult {
  if (violationChange <= 0 && stability !== "lost") return "stable";
  if (violationChange > 0 && violationChange <= 2 && stability === "unchanged") return "degraded";
  return "failed";
}

export function computeRobustnessScore(
  violationChange: number,
  baselineViolations: number,
  stability: FeasibilityStability,
): number {
  const penalty = Math.max(0, violationChange) / Math.max(1, baselineViolations);
  const lostPenalty = stability === "lost" ? 0.5 : 0;
  const score = 1 - penalty - lostPenalty;
  return Math.max(0, Math.min(1, +score.toFixed(4)));
}
