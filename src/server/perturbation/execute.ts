import { resolveCase } from "../simulation/cases";
import { runDcEvaluation } from "../simulation/dc-powerflow";
import { callExternalPerturbation } from "../simulation/external-client";
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
  simulation_engine: string | null;
}

function buildOutcome(
  baselineFeasibility: string,
  perturbedFeasibility: string,
  baselineViolations: number,
  perturbedViolations: number,
  notes: string | null,
  start: number,
): ExecutedPerturbationOutcome {
  const violation_change = perturbedViolations - baselineViolations;
  const stability = computeFeasibilityStability(baselineFeasibility, perturbedFeasibility);
  const robustness_result = computeRobustnessResult(violation_change, stability);
  const robustness_score = computeRobustnessScore(violation_change, baselineViolations, stability);
  return {
    baseline_feasibility: baselineFeasibility,
    perturbed_feasibility: perturbedFeasibility,
    baseline_violations: baselineViolations,
    perturbed_violations: perturbedViolations,
    violation_change,
    feasibility_stability: stability,
    robustness_result,
    robustness_score,
    notes,
    execution_time_ms: Date.now() - start,
    failure_reason: null,
  };
}

/**
 * Execute one perturbation: re-evaluate with the agent's action against the
 * perturbed case and compare to the baseline (un-perturbed, action applied).
 *
 * Tier 1: external pandapower service (/simulate_perturbed) — supports any case
 *         (ieee39, ieee57, ieee118, …) the service knows about.
 * Tier 2: in-Worker DC power flow on built-in cases (ieee9/14/30).
 * Tier 3: skipped — no simulator available.
 */
export async function executePerturbation(
  caseName: string,
  action: StructuredAction,
  spec: PerturbationSpec,
): Promise<ExecutedPerturbationOutcome> {
  const start = Date.now();
  try {
    // Tier 1: external pandapower service
    const ext = await callExternalPerturbation(caseName, action, {
      perturbation_type: spec.perturbation_type,
      parameter_name: spec.parameter_name,
      parameter_value: spec.parameter_value,
      description: spec.description,
    });
    if (ext) {
      return buildOutcome(
        ext.baseline.feasibility,
        ext.perturbed.feasibility,
        ext.baseline.post_action_violations,
        ext.perturbed.post_action_violations,
        ext.perturbed.notes ?? null,
        start,
      );
    }

    // Tier 2: in-Worker DC power flow on built-in cases
    const baseCase = resolveCase(caseName);
    if (!baseCase) {
      const reason = `No simulator available for case '${caseName}'. Configure an external pandapower service (SIMULATION_SERVICE_URL) to enable perturbation tests for this case, or use a built-in case (ieee9/ieee14/ieee30).`;
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

    return buildOutcome(
      baselineSim.feasibility,
      perturbedSim.feasibility,
      baselineSim.post_action_violations,
      perturbedSim.post_action_violations,
      perturbedSim.notes,
      start,
    );
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
