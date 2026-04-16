
CREATE TABLE public.run_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL UNIQUE,
  recommendation_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT run_recommendations_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE CASCADE
);

ALTER TABLE public.run_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own run_recommendations" ON public.run_recommendations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM runs WHERE runs.id = run_recommendations.run_id AND runs.user_id = auth.uid()));
CREATE POLICY "Users can create own run_recommendations" ON public.run_recommendations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM runs WHERE runs.id = run_recommendations.run_id AND runs.user_id = auth.uid()));
CREATE POLICY "Users can update own run_recommendations" ON public.run_recommendations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM runs WHERE runs.id = run_recommendations.run_id AND runs.user_id = auth.uid()));
CREATE POLICY "Users can delete own run_recommendations" ON public.run_recommendations FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM runs WHERE runs.id = run_recommendations.run_id AND runs.user_id = auth.uid()));

CREATE TRIGGER update_run_recommendations_updated_at BEFORE UPDATE ON public.run_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.run_parse_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL UNIQUE,
  source_text TEXT,
  parser_notes TEXT,
  action_type TEXT,
  target_index INTEGER,
  value DOUBLE PRECISION,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT run_parse_results_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE CASCADE
);

ALTER TABLE public.run_parse_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own run_parse_results" ON public.run_parse_results FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM runs WHERE runs.id = run_parse_results.run_id AND runs.user_id = auth.uid()));
CREATE POLICY "Users can create own run_parse_results" ON public.run_parse_results FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM runs WHERE runs.id = run_parse_results.run_id AND runs.user_id = auth.uid()));
CREATE POLICY "Users can update own run_parse_results" ON public.run_parse_results FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM runs WHERE runs.id = run_parse_results.run_id AND runs.user_id = auth.uid()));
CREATE POLICY "Users can delete own run_parse_results" ON public.run_parse_results FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM runs WHERE runs.id = run_parse_results.run_id AND runs.user_id = auth.uid()));

CREATE TRIGGER update_run_parse_results_updated_at BEFORE UPDATE ON public.run_parse_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
