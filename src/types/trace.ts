export type StageType =
  | "retrieval"
  | "planning"
  | "tool_use"
  | "reasoning"
  | "validation"
  | "execution"
  | "evaluation";

export type TraceStatus = "success" | "warning" | "failure";

export interface DecisionTrace {
  id: string;
  run_id: string;
  sequence: number;
  stage_name: string;
  stage_type: StageType;
  input_summary: string | null;
  output_summary: string | null;
  tool_name: string | null;
  status: TraceStatus;
  failure_reason: string | null;
  execution_time_ms: number;
  evidence: unknown | null;
  created_at: string;
}

export interface StageAggregate {
  stage_type: StageType;
  total: number;
  failures: number;
  avg_time_ms: number;
}

export interface BatchTraceAnalytics {
  total_traces: number;
  total_runs: number;
  most_common_failure_stage: StageType | null;
  per_stage: StageAggregate[];
}
