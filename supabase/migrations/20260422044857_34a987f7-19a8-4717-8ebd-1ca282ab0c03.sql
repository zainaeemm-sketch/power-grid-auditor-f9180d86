CREATE TABLE public.simulation_health_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  configured BOOLEAN NOT NULL DEFAULT false,
  service_url TEXT,
  overall_ok BOOLEAN NOT NULL DEFAULT false,
  version_status INTEGER,
  version_value TEXT,
  version_engine TEXT,
  version_latency_ms INTEGER,
  version_error TEXT,
  health_status INTEGER,
  health_latency_ms INTEGER,
  health_error TEXT,
  health_body TEXT,
  simulates JSONB NOT NULL DEFAULT '[]'::jsonb,
  sim_all_ok BOOLEAN NOT NULL DEFAULT false,
  sim_total_count INTEGER NOT NULL DEFAULT 0,
  sim_pass_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.simulation_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own simulation_health_checks"
  ON public.simulation_health_checks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own simulation_health_checks"
  ON public.simulation_health_checks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own simulation_health_checks"
  ON public.simulation_health_checks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_simulation_health_checks_user_created
  ON public.simulation_health_checks (user_id, created_at DESC);
