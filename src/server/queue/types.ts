export type JobType = "run_execution" | "batch_execution" | "run_perturbation";
export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type JobLogLevel = "info" | "warn" | "error" | "metric";

export interface JobRecord {
  id: string;
  user_id: string;
  job_type: JobType;
  payload: Record<string, any>;
  status: JobStatus;
  priority: number;
  attempts: number;
  max_attempts: number;
  started_at: string | null;
  completed_at: string | null;
  execution_time_ms: number | null;
  error_message: string | null;
  worker_id: string | null;
  lease_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobLog {
  id: string;
  job_id: string;
  user_id: string;
  level: JobLogLevel;
  message: string;
  metadata: Record<string, any> | null;
  created_at: string;
}
