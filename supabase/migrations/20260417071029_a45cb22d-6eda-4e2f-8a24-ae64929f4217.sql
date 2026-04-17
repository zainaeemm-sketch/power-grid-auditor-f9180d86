CREATE TABLE public.validation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  test_name text NOT NULL,
  test_type text NOT NULL,
  expected_output jsonb,
  actual_output jsonb,
  status text NOT NULL,
  failure_reason text,
  debug_hint text,
  execution_time_ms integer NOT NULL DEFAULT 0,
  system_version text,
  parser_version text,
  evaluation_logic_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.validation_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own validation_results"
ON public.validation_results FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own validation_results"
ON public.validation_results FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own validation_results"
ON public.validation_results FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own validation_results"
ON public.validation_results FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_validation_results_user_created ON public.validation_results(user_id, created_at DESC);