ALTER TABLE public.runs
  ADD COLUMN IF NOT EXISTS ai_explanation text,
  ADD COLUMN IF NOT EXISTS ai_explanation_model text,
  ADD COLUMN IF NOT EXISTS ai_explanation_generated_at timestamptz;