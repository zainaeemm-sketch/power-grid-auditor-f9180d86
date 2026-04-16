
CREATE TABLE public.run_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL UNIQUE REFERENCES public.runs(id) ON DELETE CASCADE,
  feasibility text NOT NULL DEFAULT 'unknown',
  violations_found integer NOT NULL DEFAULT 0,
  baseline_violations integer NOT NULL DEFAULT 10,
  post_action_violations integer NOT NULL DEFAULT 10,
  violation_improvement numeric NOT NULL DEFAULT 0,
  confidence text NOT NULL DEFAULT 'low',
  grounding_quality text NOT NULL DEFAULT 'none',
  action_applied text NOT NULL DEFAULT 'No action applied',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.run_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own run_evaluations"
ON public.run_evaluations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM runs WHERE runs.id = run_evaluations.run_id AND runs.user_id = auth.uid()));

CREATE POLICY "Users can create own run_evaluations"
ON public.run_evaluations FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM runs WHERE runs.id = run_evaluations.run_id AND runs.user_id = auth.uid()));

CREATE POLICY "Users can update own run_evaluations"
ON public.run_evaluations FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM runs WHERE runs.id = run_evaluations.run_id AND runs.user_id = auth.uid()));

CREATE POLICY "Users can delete own run_evaluations"
ON public.run_evaluations FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM runs WHERE runs.id = run_evaluations.run_id AND runs.user_id = auth.uid()));

CREATE TRIGGER update_run_evaluations_updated_at
BEFORE UPDATE ON public.run_evaluations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
