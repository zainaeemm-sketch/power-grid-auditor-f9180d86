-- Extend experiment_presets with reproducibility fields
ALTER TABLE public.experiment_presets
  ADD COLUMN IF NOT EXISTS system_prompt text,
  ADD COLUMN IF NOT EXISTS temperature numeric,
  ADD COLUMN IF NOT EXISTS max_tokens integer,
  ADD COLUMN IF NOT EXISTS top_p numeric,
  ADD COLUMN IF NOT EXISTS prompt_template_version text,
  ADD COLUMN IF NOT EXISTS parser_version text,
  ADD COLUMN IF NOT EXISTS evaluation_logic_version text;

-- Extend run_metadata with full configuration snapshot fields
ALTER TABLE public.run_metadata
  ADD COLUMN IF NOT EXISTS system_prompt text,
  ADD COLUMN IF NOT EXISTS temperature numeric,
  ADD COLUMN IF NOT EXISTS max_tokens integer,
  ADD COLUMN IF NOT EXISTS top_p numeric,
  ADD COLUMN IF NOT EXISTS prompt_template_version text,
  ADD COLUMN IF NOT EXISTS parser_version text,
  ADD COLUMN IF NOT EXISTS evaluation_logic_version text,
  ADD COLUMN IF NOT EXISTS benchmark_case_version text,
  ADD COLUMN IF NOT EXISTS execution_timestamp timestamptz;

-- Extend runs with parent linkage for re-runs
ALTER TABLE public.runs
  ADD COLUMN IF NOT EXISTS parent_run_id uuid REFERENCES public.runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rerun_source text;

CREATE INDEX IF NOT EXISTS idx_runs_parent_run_id ON public.runs(parent_run_id);

-- Extend batches with shared configuration snapshot
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS shared_config jsonb;