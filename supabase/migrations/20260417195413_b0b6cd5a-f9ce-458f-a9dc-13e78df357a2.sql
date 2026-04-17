-- perturbation_tests
CREATE TABLE public.perturbation_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  perturbation_type text NOT NULL,
  parameter_name text NOT NULL,
  parameter_value numeric,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_perturbation_tests_run_id ON public.perturbation_tests(run_id);

ALTER TABLE public.perturbation_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own perturbation_tests"
  ON public.perturbation_tests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.runs WHERE runs.id = perturbation_tests.run_id AND runs.user_id = auth.uid()));

CREATE POLICY "Users can create own perturbation_tests"
  ON public.perturbation_tests FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.runs WHERE runs.id = perturbation_tests.run_id AND runs.user_id = auth.uid()));

CREATE POLICY "Users can update own perturbation_tests"
  ON public.perturbation_tests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.runs WHERE runs.id = perturbation_tests.run_id AND runs.user_id = auth.uid()));

CREATE POLICY "Users can delete own perturbation_tests"
  ON public.perturbation_tests FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.runs WHERE runs.id = perturbation_tests.run_id AND runs.user_id = auth.uid()));

-- perturbation_results
CREATE TABLE public.perturbation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perturbation_test_id uuid NOT NULL REFERENCES public.perturbation_tests(id) ON DELETE CASCADE,
  baseline_feasibility text NOT NULL DEFAULT 'unknown',
  perturbed_feasibility text NOT NULL DEFAULT 'unknown',
  baseline_violations integer NOT NULL DEFAULT 0,
  perturbed_violations integer NOT NULL DEFAULT 0,
  violation_change integer NOT NULL DEFAULT 0,
  feasibility_stability text NOT NULL DEFAULT 'unchanged',
  robustness_result text NOT NULL DEFAULT 'stable',
  robustness_score numeric NOT NULL DEFAULT 1,
  notes text,
  execution_time_ms integer NOT NULL DEFAULT 0,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_perturbation_results_test_id ON public.perturbation_results(perturbation_test_id);

ALTER TABLE public.perturbation_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own perturbation_results"
  ON public.perturbation_results FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.perturbation_tests pt
    JOIN public.runs r ON r.id = pt.run_id
    WHERE pt.id = perturbation_results.perturbation_test_id AND r.user_id = auth.uid()
  ));

CREATE POLICY "Users can create own perturbation_results"
  ON public.perturbation_results FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.perturbation_tests pt
    JOIN public.runs r ON r.id = pt.run_id
    WHERE pt.id = perturbation_results.perturbation_test_id AND r.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own perturbation_results"
  ON public.perturbation_results FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.perturbation_tests pt
    JOIN public.runs r ON r.id = pt.run_id
    WHERE pt.id = perturbation_results.perturbation_test_id AND r.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own perturbation_results"
  ON public.perturbation_results FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.perturbation_tests pt
    JOIN public.runs r ON r.id = pt.run_id
    WHERE pt.id = perturbation_results.perturbation_test_id AND r.user_id = auth.uid()
  ));