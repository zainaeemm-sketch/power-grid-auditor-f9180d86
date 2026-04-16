import type { Tables } from "@/integrations/supabase/types";

export type Run = Tables<"runs">;
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
  created_at: string;
  updated_at: string;
}

export interface RunDetails {
  run: Run;
  metadata: RunMetadata | null;
  promptLog: RunPromptLog | null;
  recommendation: RunRecommendation | null;
  parseResult: RunParseResult | null;
  evaluation: RunEvaluation | null;
}
