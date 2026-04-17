ALTER TABLE public.run_metadata ADD COLUMN IF NOT EXISTS evaluation_mode text NOT NULL DEFAULT 'rule_based';
ALTER TABLE public.run_evaluations ADD COLUMN IF NOT EXISTS engine_used text;
ALTER TABLE public.run_evaluations ADD COLUMN IF NOT EXISTS simulation_details jsonb;
ALTER TABLE public.experiment_presets ADD COLUMN IF NOT EXISTS evaluation_mode text NOT NULL DEFAULT 'rule_based';