-- Ground Truth / Reference Solution Layer

CREATE TABLE public.ground_truth_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id text NOT NULL,
  case_name text NOT NULL,
  scenario_description text,
  difficulty_level text NOT NULL DEFAULT 'medium',
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scenario_id)
);

ALTER TABLE public.ground_truth_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ground_truth_scenarios" ON public.ground_truth_scenarios
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own ground_truth_scenarios" ON public.ground_truth_scenarios
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own ground_truth_scenarios" ON public.ground_truth_scenarios
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own ground_truth_scenarios" ON public.ground_truth_scenarios
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_ground_truth_scenarios_updated_at
  BEFORE UPDATE ON public.ground_truth_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ground_truth_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES public.ground_truth_scenarios(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  target_index integer,
  value double precision,
  expected_feasibility boolean NOT NULL DEFAULT true,
  expected_violations integer NOT NULL DEFAULT 0,
  expected_violation_improvement numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ground_truth_actions_scenario_id ON public.ground_truth_actions(scenario_id);

ALTER TABLE public.ground_truth_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ground_truth_actions" ON public.ground_truth_actions
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.ground_truth_scenarios s
    WHERE s.id = ground_truth_actions.scenario_id AND s.user_id = auth.uid()
  ));
CREATE POLICY "Users insert own ground_truth_actions" ON public.ground_truth_actions
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.ground_truth_scenarios s
    WHERE s.id = ground_truth_actions.scenario_id AND s.user_id = auth.uid()
  ));
CREATE POLICY "Users update own ground_truth_actions" ON public.ground_truth_actions
  FOR UPDATE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.ground_truth_scenarios s
    WHERE s.id = ground_truth_actions.scenario_id AND s.user_id = auth.uid()
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.ground_truth_scenarios s
    WHERE s.id = ground_truth_actions.scenario_id AND s.user_id = auth.uid()
  ));
CREATE POLICY "Users delete own ground_truth_actions" ON public.ground_truth_actions
  FOR DELETE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.ground_truth_scenarios s
    WHERE s.id = ground_truth_actions.scenario_id AND s.user_id = auth.uid()
  ));

-- Soft link runs → scenarios (nullable, no FK for backward compat)
ALTER TABLE public.runs ADD COLUMN ground_truth_scenario_id uuid;

-- Extend run_evaluations with ground truth comparison fields
ALTER TABLE public.run_evaluations
  ADD COLUMN action_match text,
  ADD COLUMN feasibility_match text,
  ADD COLUMN optimality_gap numeric,
  ADD COLUMN deviation_from_reference numeric,
  ADD COLUMN evaluation_against_ground_truth boolean NOT NULL DEFAULT false;
