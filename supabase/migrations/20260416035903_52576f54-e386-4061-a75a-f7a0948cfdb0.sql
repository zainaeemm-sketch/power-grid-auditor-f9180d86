
-- Drop old permissive policies
DROP POLICY IF EXISTS "Allow all access to runs" ON public.runs;
DROP POLICY IF EXISTS "Allow all access to run_metadata" ON public.run_metadata;
DROP POLICY IF EXISTS "Allow all access to run_prompt_logs" ON public.run_prompt_logs;
DROP POLICY IF EXISTS "Allow all access to experiment_presets" ON public.experiment_presets;

-- runs: user owns their runs
CREATE POLICY "Users can view own runs" ON public.runs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own runs" ON public.runs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own runs" ON public.runs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own runs" ON public.runs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- run_metadata: accessible if parent run belongs to user
CREATE POLICY "Users can view own run_metadata" ON public.run_metadata FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.runs WHERE runs.id = run_metadata.run_id AND runs.user_id = auth.uid()));
CREATE POLICY "Users can create own run_metadata" ON public.run_metadata FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.runs WHERE runs.id = run_metadata.run_id AND runs.user_id = auth.uid()));
CREATE POLICY "Users can update own run_metadata" ON public.run_metadata FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.runs WHERE runs.id = run_metadata.run_id AND runs.user_id = auth.uid()));
CREATE POLICY "Users can delete own run_metadata" ON public.run_metadata FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.runs WHERE runs.id = run_metadata.run_id AND runs.user_id = auth.uid()));

-- run_prompt_logs: accessible if parent run belongs to user
CREATE POLICY "Users can view own run_prompt_logs" ON public.run_prompt_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.runs WHERE runs.id = run_prompt_logs.run_id AND runs.user_id = auth.uid()));
CREATE POLICY "Users can create own run_prompt_logs" ON public.run_prompt_logs FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.runs WHERE runs.id = run_prompt_logs.run_id AND runs.user_id = auth.uid()));
CREATE POLICY "Users can update own run_prompt_logs" ON public.run_prompt_logs FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.runs WHERE runs.id = run_prompt_logs.run_id AND runs.user_id = auth.uid()));
CREATE POLICY "Users can delete own run_prompt_logs" ON public.run_prompt_logs FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.runs WHERE runs.id = run_prompt_logs.run_id AND runs.user_id = auth.uid()));

-- experiment_presets: user owns their presets
CREATE POLICY "Users can view own presets" ON public.experiment_presets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own presets" ON public.experiment_presets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own presets" ON public.experiment_presets FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own presets" ON public.experiment_presets FOR DELETE TO authenticated USING (auth.uid() = user_id);
