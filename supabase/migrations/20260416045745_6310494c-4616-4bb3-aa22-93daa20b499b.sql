
-- Create batches table
CREATE TABLE public.batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  task text NOT NULL,
  research_question text,
  status text NOT NULL DEFAULT 'queued',
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own batches" ON public.batches FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own batches" ON public.batches FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own batches" ON public.batches FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own batches" ON public.batches FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON public.batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create batch_run_links table
CREATE TABLE public.batch_run_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(batch_id, run_id)
);

ALTER TABLE public.batch_run_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own batch_run_links" ON public.batch_run_links FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.batches WHERE batches.id = batch_run_links.batch_id AND batches.user_id = auth.uid()));
CREATE POLICY "Users can create own batch_run_links" ON public.batch_run_links FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.batches WHERE batches.id = batch_run_links.batch_id AND batches.user_id = auth.uid()));
CREATE POLICY "Users can delete own batch_run_links" ON public.batch_run_links FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.batches WHERE batches.id = batch_run_links.batch_id AND batches.user_id = auth.uid()));
