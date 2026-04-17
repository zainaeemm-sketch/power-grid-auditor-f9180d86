import type { Tables } from "@/integrations/supabase/types";

export type Run = Tables<"runs"> & { ground_truth_scenario_id?: string | null };
export type RunMetadata = Tables<"run_metadata">;
export type RunPromptLog = Tables<"run_prompt_logs">;
export type ExperimentPreset = Tables<"experiment_presets">;
export type RunStatus = "queued" | "running" | "completed";

export interface RunRecommendation {
  id: string;
  run_id: string;
  recommendation_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface RunParseResult {
  id: string;
  run_id: string;
  source_text: string | null;
  parser_notes: string | null;
  action_type: string | null;
  target_index: number | null;
  value: number | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type SimulationEngine = "rule_based" | "dc_powerflow" | "pandapower";

export interface SimulationDetails {
  line_loadings?: Array<{
    branch_index: number;
    from_bus: number;
    to_bus: number;
    flow_mw: number;
    rate_mw: number;
    loading_pct: number;
    overloaded: boolean;
  }>;
  voltage_violations?: Array<{ bus_index: number; vm_pu: number; type: "low" | "high" }>;
  generator_violations?: Array<{ generator_index: number; bus: number; p_mw: number; type: "below_min" | "above_max" }>;
}

export interface RunEvaluation {
  id: string;
  run_id: string;
  feasibility: string;
  violations_found: number;
  baseline_violations: number;
  post_action_violations: number;
  violation_improvement: number;
  confidence: string;
  grounding_quality: string;
  action_applied: string;
  notes: string | null;
  engine_used?: SimulationEngine | null;
  simulation_details?: SimulationDetails | null;
  // Ground truth comparison (nullable — backward compat)
  action_match?: "exact" | "partial" | "none" | null;
  feasibility_match?: "correct" | "incorrect" | null;
  optimality_gap?: number | null;
  deviation_from_reference?: number | null;
  evaluation_against_ground_truth?: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface GroundTruthScenario {
  id: string;
  scenario_id: string;
  case_name: string;
  scenario_description: string | null;
  difficulty_level: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface GroundTruthAction {
  id: string;
  scenario_id: string;
  action_type: string;
  target_index: number | null;
  value: number | null;
  expected_feasibility: boolean;
  expected_violations: number;
  expected_violation_improvement: number;
  notes: string | null;
  created_at: string;
}

export interface GroundTruthScenarioWithActions {
  scenario: GroundTruthScenario;
  actions: GroundTruthAction[];
}

export interface GroundTruthScenarioListItem extends GroundTruthScenario {
  action_count: number;
}

export interface RunDetails {
  run: Run;
  metadata: RunMetadata | null;
  promptLog: RunPromptLog | null;
  recommendation: RunRecommendation | null;
  parseResult: RunParseResult | null;
  evaluation: RunEvaluation | null;
}

export interface RunAction {
  id: string;
  run_id: string;
  action_type: string | null;
  target_index: number | null;
  value: number | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Batch {
  id: string;
  name: string;
  task: string;
  research_question: string | null;
  status: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface BatchRunLink {
  id: string;
  batch_id: string;
  run_id: string;
  agent: string | null;
  case_name: string | null;
  recommendation_text: string | null;
  created_at: string;
}
export interface BatchRunWithEvaluation {
  run: Run;
  evaluation: RunEvaluation | null;
  metadata?: RunMetadata | null;
}

export interface BatchDetails {
  batch: Batch;
  runs: BatchRunWithEvaluation[];
}

export type { JobRecord, JobLog, JobType, JobStatus, JobLogLevel } from "@/server/queue/types";
