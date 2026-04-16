
-- Create run status enum
CREATE TYPE public.run_status AS ENUM ('queued', 'running', 'completed');

-- Create runs table
CREATE TABLE public.runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  task TEXT NOT NULL,
  agent TEXT NOT NULL,
  case_name TEXT NOT NULL,
  research_question TEXT,
  status public.run_status NOT NULL DEFAULT 'queued',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to runs" ON public.runs FOR ALL USING (true) WITH CHECK (true);

-- Create run_metadata table
CREATE TABLE public.run_metadata (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  provider_name TEXT,
  provider_base_url TEXT,
  model_name TEXT,
  model_version TEXT,
  prompt_version TEXT,
  dataset_version TEXT,
  random_seed INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.run_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to run_metadata" ON public.run_metadata FOR ALL USING (true) WITH CHECK (true);

-- Create run_prompt_logs table
CREATE TABLE public.run_prompt_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  prompt_text TEXT,
  response_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.run_prompt_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to run_prompt_logs" ON public.run_prompt_logs FOR ALL USING (true) WITH CHECK (true);

-- Create experiment_presets table
CREATE TABLE public.experiment_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  provider_name TEXT,
  provider_base_url TEXT,
  model_name TEXT,
  model_version TEXT,
  prompt_version TEXT,
  dataset_version TEXT,
  random_seed INTEGER,
  notes TEXT,
  default_prompt_text TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.experiment_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to experiment_presets" ON public.experiment_presets FOR ALL USING (true) WITH CHECK (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers
CREATE TRIGGER update_runs_updated_at BEFORE UPDATE ON public.runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_run_metadata_updated_at BEFORE UPDATE ON public.run_metadata FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_run_prompt_logs_updated_at BEFORE UPDATE ON public.run_prompt_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_experiment_presets_updated_at BEFORE UPDATE ON public.experiment_presets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
