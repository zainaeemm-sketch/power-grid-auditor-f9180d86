-- case_meta_overrides: per-user accepted fixes for invalid case metadata fields
CREATE TABLE public.case_meta_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  case_key TEXT NOT NULL,
  field TEXT NOT NULL,
  value JSONB NOT NULL,
  source TEXT NOT NULL DEFAULT 'ai_suggested',
  ai_rationale TEXT,
  ai_model TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT case_meta_overrides_source_chk CHECK (source IN ('ai_suggested','manual')),
  CONSTRAINT case_meta_overrides_unique UNIQUE (user_id, case_key, field)
);

CREATE INDEX idx_case_meta_overrides_user ON public.case_meta_overrides (user_id);

ALTER TABLE public.case_meta_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own case_meta_overrides"
  ON public.case_meta_overrides FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own case_meta_overrides"
  ON public.case_meta_overrides FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own case_meta_overrides"
  ON public.case_meta_overrides FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own case_meta_overrides"
  ON public.case_meta_overrides FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_case_meta_overrides_updated_at
  BEFORE UPDATE ON public.case_meta_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();