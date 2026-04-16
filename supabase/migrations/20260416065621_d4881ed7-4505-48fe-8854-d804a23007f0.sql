
-- 1. Create run_actions table
CREATE TABLE public.run_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  action_type text,
  target_index integer,
  value double precision,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.run_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own run_actions" ON public.run_actions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM runs WHERE runs.id = run_actions.run_id AND runs.user_id = auth.uid()));

CREATE POLICY "Users can create own run_actions" ON public.run_actions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM runs WHERE runs.id = run_actions.run_id AND runs.user_id = auth.uid()));

CREATE POLICY "Users can update own run_actions" ON public.run_actions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM runs WHERE runs.id = run_actions.run_id AND runs.user_id = auth.uid()));

CREATE POLICY "Users can delete own run_actions" ON public.run_actions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM runs WHERE runs.id = run_actions.run_id AND runs.user_id = auth.uid()));

CREATE TRIGGER update_run_actions_updated_at
  BEFORE UPDATE ON public.run_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add denormalized columns to batch_run_links
ALTER TABLE public.batch_run_links
  ADD COLUMN agent text,
  ADD COLUMN case_name text,
  ADD COLUMN recommendation_text text;
