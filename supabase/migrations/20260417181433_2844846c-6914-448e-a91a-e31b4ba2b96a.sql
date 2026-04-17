-- Recreate UPDATE policies with WITH CHECK clauses to prevent ownership changes
-- and tampering with server-controlled fields.

-- job_queue: keep ownership, prevent changing user_id and core scheduling fields
DROP POLICY IF EXISTS "Users can update own jobs" ON public.job_queue;
CREATE POLICY "Users can update own jobs"
  ON public.job_queue
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- validation_results: prevent changing user_id on update
DROP POLICY IF EXISTS "Users can update own validation_results" ON public.validation_results;
CREATE POLICY "Users can update own validation_results"
  ON public.validation_results
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);