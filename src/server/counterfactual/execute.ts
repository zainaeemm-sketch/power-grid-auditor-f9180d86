import { runSimulation } from "../simulation/engine";
import type { EvaluationMode, SimulationResult, StructuredAction } from "../simulation/types";
import type {
  CounterfactualSpec,
  FeasibilityChange,
  CounterfactualStatus,
} from "./types";

export interface ExecutedCounterfactualOutcome {
  baseline_action_type: string | null;
  counterfactual_action_type: string;
  baseline_feasibility: string;
  counterfactual_feasibility: string;
  baseline_violations: number;
  counterfactual_violations: number;
  baseline_improvement: number;
  counterfactual_improvement: number;
  violation_difference: number;
  improvement_difference: number;
  optimality_gap: number;
  decision_regret: number;
  feasibility_change: FeasibilityChange;
  status: CounterfactualStatus;
  failure_reason: string | null;
  execution_time_ms: number;
}

function feasibilityChange(b: string, c: string): FeasibilityChange {
  if (b === c) return "unchanged";
  if (c === "feasible" && b !== "feasible") return "improved";
  if (b === "feasible" && c !== "feasible") return "worsened";
  return "unchanged";
}

/**
 * Execute one counterfactual action against the same case as the baseline run.
 * Uses the tiered simulator (external pandapower → in-Worker DC PF) so cases
 * not bundled in the Worker (e.g. ieee39) still produce real results when an
 * external simulation service is configured.
 */
export async function executeCounterfactual(
  caseName: string,
  baseline: StructuredAction,
  spec: CounterfactualSpec,
  mode: EvaluationMode = "auto",
): Promise<ExecutedCounterfactualOutcome> {
  const start = Date.now();
  const baseline_action_type = baseline.action_type ?? null;
  const counterfactual_action_type = spec.action_type;

  try {
    const cfAction: StructuredAction = {
      action_type: spec.action_type,
      target_index: spec.target_index,
      value: spec.value,
      enabled: true,
    };

    const [baselineSim, cfSim]: [SimulationResult | null, SimulationResult | null] =
      await Promise.all([
        runSimulation(caseName, baseline, mode),
        runSimulation(caseName, cfAction, mode),
      ]);

    if (!baselineSim || !cfSim) {
      throw new Error(
        `No simulator available for case '${caseName}'. Configure an external pandapower service or use a built-in case.`,
      );
    }

    const baseline_violations = baselineSim.post_action_violations;
    const counterfactual_violations = cfSim.post_action_violations;
    const baseline_improvement = baselineSim.violation_improvement;
    const counterfactual_improvement = cfSim.violation_improvement;

    const violation_difference = counterfactual_violations - baseline_violations;
    const improvement_difference = counterfactual_improvement - baseline_improvement;
    const optimality_gap = Math.max(0, counterfactual_improvement - baseline_improvement);
    const decision_regret = optimality_gap;

    return {
      baseline_action_type,
      counterfactual_action_type,
      baseline_feasibility: baselineSim.feasibility,
      counterfactual_feasibility: cfSim.feasibility,
      baseline_violations,
      counterfactual_violations,
      baseline_improvement,
      counterfactual_improvement,
      violation_difference,
      improvement_difference,
      optimality_gap: +optimality_gap.toFixed(4),
      decision_regret: +decision_regret.toFixed(4),
      feasibility_change: feasibilityChange(baselineSim.feasibility, cfSim.feasibility),
      status: "success",
      failure_reason: null,
      execution_time_ms: Date.now() - start,
    };
  } catch (e: any) {
    return {
      baseline_action_type,
      counterfactual_action_type,
      baseline_feasibility: "unknown",
      counterfactual_feasibility: "unknown",
      baseline_violations: 0,
      counterfactual_violations: 0,
      baseline_improvement: 0,
      counterfactual_improvement: 0,
      violation_difference: 0,
      improvement_difference: 0,
      optimality_gap: 0,
      decision_regret: 0,
      feasibility_change: "unchanged",
      status: "failure",
      failure_reason: e?.message ?? "Unknown counterfactual failure",
      execution_time_ms: Date.now() - start,
    };
  }
}
