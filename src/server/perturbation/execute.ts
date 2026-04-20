import { resolveCase } from "../simulation/cases";
import { runDcEvaluation } from "../simulation/dc-powerflow";
import type { StructuredAction } from "../simulation/types";
import { applyPerturbation } from "./apply";
import {
  computeFeasibilityStability,
  computeRobustnessResult,
  computeRobustnessScore,
} from "./metrics";
import type { PerturbationSpec } from "./types";

export interface ExecutedPerturbationOutcome {
  baseline_feasibility: string;
  perturbed_feasibility: string;
  baseline_violations: number;
  perturbed_violations: number;
  violation_change: number;
  feasibility_stability: string;
  robustness_result: string;
  robustness_score: number;
  notes: string | null;
  execution_time_ms: number;
  failure_reason: string | null;
}

/**
 * Execute one perturbation: re-evaluate with the agent's action against the
 * perturbed case and compare to the baseline (un-perturbed, action applied).
 */
export function executePerturbation(
  caseName: string,
  action: StructuredAction,
  spec: PerturbationSpec,
): ExecutedPerturbationOutcome {
  const start = Date.now();
  try {
    const baseCase = resolveCase(caseName);
    if (!baseCase) {
      // Perturbations require structural mutation of the case (line outages,
      // load scaling, etc.) which we can only do on built-in cases. The
      // external pandapower service does not yet expose a perturbation API,
      // so for cases like ieee39 we mark the test as skipped (not failed).
      const reason = `No simulator available for case '${caseName}'. Perturbation tests require a built-in case (ieee9/ieee14/ieee30) or an external pandapower service with perturbation support.`;
      return {
        baseline_feasibility: "unknown",
        perturbed_feasibility: "unknown",
        baseline_violations: 0,
        perturbed_violations: 0,
        violation_change: 0,
        feasibility_stability: "unchanged",
        robustness_result: "skipped",
        robustness_score: 0,
        notes: reason,
        execution_time_ms: Date.now() - start,
        failure_reason: reason,
      };
    }

    const baselineSim = runDcEvaluation(baseCase, action);
    const perturbedCase = applyPerturbation(baseCase, spec);
    const perturbedSim = runDcEvaluation(perturbedCase, action);

    if (!baselineSim || !perturbedSim) {
      throw new Error("DC power flow failed to converge for baseline or perturbed case.");
    }

    const baseline_violations = baselineSim.post_action_violations;
    const perturbed_violations = perturbedSim.post_action_violations;
    const violation_change = perturbed_violations - baseline_violations;
    const stability = computeFeasibilityStability(
      baselineSim.feasibility,
      perturbedSim.feasibility,
    );
    const robustness_result = computeRobustnessResult(violation_change, stability);
    const robustness_score = computeRobustnessScore(
      violation_change,
      baseline_violations,
      stability,
    );

    return {
      baseline_feasibility: baselineSim.feasibility,
      perturbed_feasibility: perturbedSim.feasibility,
      baseline_violations,
      perturbed_violations,
      violation_change,
      feasibility_stability: stability,
      robustness_result,
      robustness_score,
      notes: perturbedSim.notes,
      execution_time_ms: Date.now() - start,
      failure_reason: null,
    };
  } catch (e: any) {
    return {
      baseline_feasibility: "unknown",
      perturbed_feasibility: "unknown",
      baseline_violations: 0,
      perturbed_violations: 0,
      violation_change: 0,
      feasibility_stability: "unchanged",
      robustness_result: "failed",
      robustness_score: 0,
      notes: null,
      execution_time_ms: Date.now() - start,
      failure_reason: e?.message ?? "Unknown perturbation failure",
    };
  }
}
