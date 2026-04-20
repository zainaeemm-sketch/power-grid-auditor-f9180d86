-- Counterfactual actions: alternative actions to evaluate against a run's baseline
CREATE TABLE public.counterfactual_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  target_index INTEGER,
  value DOUBLE PRECISION,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'default', -- 'default' | 'custom'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_counterfactual_actions_run ON public.counterfactual_actions(run_id);

ALTER TABLE public.counterfactual_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own counterfactual_actions"
  ON public.counterfactual_actions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.runs r WHERE r.id = counterfactual_actions.run_id AND r.user_id = auth.uid()));

CREATE POLICY "Users can create own counterfactual_actions"
  ON public.counterfactual_actions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.runs r WHERE r.id = counterfactual_actions.run_id AND r.user_id = auth.uid()));

CREATE POLICY "Users can delete own counterfactual_actions"
  ON public.counterfactual_actions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.runs r WHERE r.id = counterfactual_actions.run_id AND r.user_id = auth.uid()));

-- Counterfactual results: outcome of executing a counterfactual action vs baseline
CREATE TABLE public.counterfactual_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  counterfactual_action_id UUID NOT NULL,
  baseline_action_type TEXT,
  counterfactual_action_type TEXT NOT NULL,
  baseline_feasibility TEXT NOT NULL DEFAULT 'unknown',
  counterfactual_feasibility TEXT NOT NULL DEFAULT 'unknown',
  baseline_violations INTEGER NOT NULL DEFAULT 0,
  counterfactual_violations INTEGER NOT NULL DEFAULT 0,
  baseline_improvement NUMERIC NOT NULL DEFAULT 0,
  counterfactual_improvement NUMERIC NOT NULL DEFAULT 0,
  violation_difference INTEGER NOT NULL DEFAULT 0,
  improvement_difference NUMERIC NOT NULL DEFAULT 0,
  optimality_gap NUMERIC NOT NULL DEFAULT 0,
  decision_regret NUMERIC NOT NULL DEFAULT 0,
  feasibility_change TEXT NOT NULL DEFAULT 'unchanged', -- 'improved' | 'unchanged' | 'worsened'
  status TEXT NOT NULL DEFAULT 'success', -- 'success' | 'failure'
  failure_reason TEXT,
  execution_time_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_counterfactual_results_action ON public.counterfactual_results(counterfactual_action_id);

ALTER TABLE public.counterfactual_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own counterfactual_results"
  ON public.counterfactual_results FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.counterfactual_actions ca
    JOIN public.runs r ON r.id = ca.run_id
    WHERE ca.id = counterfactual_results.counterfactual_action_id AND r.user_id = auth.uid()
  ));

CREATE POLICY "Users can create own counterfactual_results"
  ON public.counterfactual_results FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.counterfactual_actions ca
    JOIN public.runs r ON r.id = ca.run_id
    WHERE ca.id = counterfactual_results.counterfactual_action_id AND r.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own counterfactual_results"
  ON public.counterfactual_results FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.counterfactual_actions ca
    JOIN public.runs r ON r.id = ca.run_id
    WHERE ca.id = counterfactual_results.counterfactual_action_id AND r.user_id = auth.uid()
  ));