ALTER TABLE public.counterfactual_results ADD COLUMN IF NOT EXISTS simulation_engine text;
ALTER TABLE public.perturbation_results ADD COLUMN IF NOT EXISTS simulation_engine text;