-- 1) run_llm_judgments table
CREATE TABLE public.run_llm_judgments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL UNIQUE REFERENCES public.runs(id) ON DELETE CASCADE,
  verdict text,
  confidence text,
  reasoning_quality text,
  action_alignment text,
  critique text,
  disagreement_reason text,
  model text,
  provider text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.run_llm_judgments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own run_llm_judgments"
ON public.run_llm_judgments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.runs r WHERE r.id = run_llm_judgments.run_id AND r.user_id = auth.uid()));

CREATE POLICY "Users can create own run_llm_judgments"
ON public.run_llm_judgments FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.runs r WHERE r.id = run_llm_judgments.run_id AND r.user_id = auth.uid()));

CREATE POLICY "Users can update own run_llm_judgments"
ON public.run_llm_judgments FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.runs r WHERE r.id = run_llm_judgments.run_id AND r.user_id = auth.uid()));

CREATE POLICY "Users can delete own run_llm_judgments"
ON public.run_llm_judgments FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.runs r WHERE r.id = run_llm_judgments.run_id AND r.user_id = auth.uid()));

CREATE TRIGGER update_run_llm_judgments_updated_at
BEFORE UPDATE ON public.run_llm_judgments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) user_preferences: add auto_judge_enabled
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS auto_judge_enabled boolean NOT NULL DEFAULT false;