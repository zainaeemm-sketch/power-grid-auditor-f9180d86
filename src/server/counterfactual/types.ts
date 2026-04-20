export type CounterfactualSource = "default" | "custom";
export type FeasibilityChange = "improved" | "unchanged" | "worsened";
export type CounterfactualStatus = "success" | "failure";

export interface CounterfactualSpec {
  action_type: string;
  target_index: number | null;
  value: number | null;
  description: string;
  source: CounterfactualSource;
}

export interface CounterfactualActionRow {
  id: string;
  run_id: string;
  action_type: string;
  target_index: number | null;
  value: number | null;
  description: string | null;
  source: string;
  created_at: string;
}

export interface CounterfactualResultRow {
  id: string;
  counterfactual_action_id: string;
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
  feasibility_change: string;
  status: string;
  failure_reason: string | null;
  execution_time_ms: number;
  created_at: string;
}

export interface CounterfactualWithResult {
  action: CounterfactualActionRow;
  result: CounterfactualResultRow | null;
}
