import type { Tables } from "@/integrations/supabase/types";

export type Run = Tables<"runs">;
export type RunMetadata = Tables<"run_metadata">;
export type RunPromptLog = Tables<"run_prompt_logs">;
export type RunRecommendation = Tables<"run_recommendations">;
export type RunParseResult = Tables<"run_parse_results">;
export type ExperimentPreset = Tables<"experiment_presets">;
export type RunStatus = "queued" | "running" | "completed";

export interface RunDetails {
  run: Run;
  metadata: RunMetadata | null;
  promptLog: RunPromptLog | null;
  recommendation: RunRecommendation | null;
  parseResult: RunParseResult | null;
}
