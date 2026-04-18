CREATE TABLE public.decision_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  stage_name text NOT NULL,
  stage_type text NOT NULL CHECK (stage_type IN ('retrieval','planning','tool_use','reasoning','validation','execution','evaluation')),
  input_summary text,
  output_summary text,
  tool_name text,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success','warning','failure')),
  failure_reason text,
  execution_time_ms integer NOT NULL DEFAULT 0,
  evidence jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_decision_traces_run_seq ON public.decision_traces(run_id, sequence);

ALTER TABLE public.decision_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own decision_traces"
  ON public.decision_traces FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.runs WHERE runs.id = decision_traces.run_id AND runs.user_id = auth.uid()));

CREATE POLICY "Users can create own decision_traces"
  ON public.decision_traces FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.runs WHERE runs.id = decision_traces.run_id AND runs.user_id = auth.uid()));

CREATE POLICY "Users can delete own decision_traces"
  ON public.decision_traces FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.runs WHERE runs.id = decision_traces.run_id AND runs.user_id = auth.uid()));