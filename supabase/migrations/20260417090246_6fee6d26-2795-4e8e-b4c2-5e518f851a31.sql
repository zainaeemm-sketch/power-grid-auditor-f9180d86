-- job_queue table
CREATE TABLE public.job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  priority int NOT NULL DEFAULT 0,
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  started_at timestamptz,
  completed_at timestamptz,
  execution_time_ms int,
  error_message text,
  worker_id text,
  lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_queue_status_priority ON public.job_queue (status, priority DESC, created_at);
CREATE INDEX idx_job_queue_user_id ON public.job_queue (user_id, created_at DESC);
CREATE INDEX idx_job_queue_lease ON public.job_queue (lease_expires_at) WHERE status = 'running';

ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs" ON public.job_queue
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own jobs" ON public.job_queue
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own jobs" ON public.job_queue
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own jobs" ON public.job_queue
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_job_queue_updated_at
BEFORE UPDATE ON public.job_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- job_logs table
CREATE TABLE public.job_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  user_id uuid NOT NULL,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_logs_job_id ON public.job_logs (job_id, created_at DESC);
CREATE INDEX idx_job_logs_user_id ON public.job_logs (user_id, created_at DESC);

ALTER TABLE public.job_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own job_logs" ON public.job_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own job_logs" ON public.job_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own job_logs" ON public.job_logs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- claim_jobs SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public.claim_jobs(
  p_user_id uuid,
  p_limit int DEFAULT 3,
  p_lease_seconds int DEFAULT 60,
  p_worker_id text DEFAULT 'worker'
)
RETURNS SETOF public.job_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.job_queue jq
  SET status = 'running',
      worker_id = p_worker_id,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      started_at = COALESCE(jq.started_at, now()),
      attempts = jq.attempts + 1,
      updated_at = now()
  WHERE jq.id IN (
    SELECT inner_jq.id
    FROM public.job_queue inner_jq
    WHERE inner_jq.user_id = p_user_id
      AND (
        inner_jq.status = 'queued'
        OR (inner_jq.status = 'running' AND inner_jq.lease_expires_at < now())
      )
      AND inner_jq.attempts < inner_jq.max_attempts
    ORDER BY inner_jq.priority DESC, inner_jq.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING jq.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_jobs(uuid, int, int, text) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_jobs(uuid, int, int, text) TO authenticated;