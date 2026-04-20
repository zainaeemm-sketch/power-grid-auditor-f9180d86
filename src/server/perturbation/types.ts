export type PerturbationType =
  | "increase_load_percent"
  | "decrease_load_percent"
  | "line_outage"
  | "line_restoration"
  | "generator_limit_change"
  | "generator_dispatch_change"
  | "n1_contingency"
  | "voltage_setpoint_shift";

export type RobustnessResult = "stable" | "degraded" | "failed";
export type FeasibilityStability = "unchanged" | "lost" | "gained";

export interface PerturbationSpec {
  perturbation_type: PerturbationType;
  parameter_name: string;
  parameter_value: number | null;
  description: string;
}

export interface PerturbationTestRow {
  id: string;
  run_id: string;
  perturbation_type: string;
  parameter_name: string;
  parameter_value: number | null;
  description: string | null;
  created_at: string;
}

export interface PerturbationResultRow {
  id: string;
  perturbation_test_id: string;
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
  created_at: string;
}

export interface PerturbationTestWithResult {
  test: PerturbationTestRow;
  result: PerturbationResultRow | null;
}
