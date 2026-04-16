
-- Add unique constraint to run_metadata (FK already exists)
ALTER TABLE public.run_metadata
  ADD CONSTRAINT run_metadata_run_id_unique UNIQUE (run_id);

-- Add FK + unique to run_prompt_logs (FK already exists from types)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'run_prompt_logs_run_id_fkey') THEN
    ALTER TABLE public.run_prompt_logs ADD CONSTRAINT run_prompt_logs_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.run_prompt_logs
  ADD CONSTRAINT run_prompt_logs_run_id_unique UNIQUE (run_id);

-- Add update triggers (skip if they already exist)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_run_metadata_updated_at') THEN
    CREATE TRIGGER update_run_metadata_updated_at BEFORE UPDATE ON public.run_metadata FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_run_prompt_logs_updated_at') THEN
    CREATE TRIGGER update_run_prompt_logs_updated_at BEFORE UPDATE ON public.run_prompt_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_runs_updated_at') THEN
    CREATE TRIGGER update_runs_updated_at BEFORE UPDATE ON public.runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_experiment_presets_updated_at') THEN
    CREATE TRIGGER update_experiment_presets_updated_at BEFORE UPDATE ON public.experiment_presets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
