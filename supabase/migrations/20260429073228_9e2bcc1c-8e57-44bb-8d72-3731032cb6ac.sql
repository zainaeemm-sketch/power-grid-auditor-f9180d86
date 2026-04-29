-- Audit log for AI-suggested case meta overrides.
-- Records every accept and revert action with actor + timestamp + value snapshots
-- so researchers can reconstruct the override history of any case/field even
-- after the underlying override row is deleted.

CREATE TABLE public.case_meta_override_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  override_id UUID,                              -- NULL after revert (FK target gone)
  user_id UUID NOT NULL,                         -- actor (whoever clicked accept/revert)
  case_key TEXT NOT NULL,
  field TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('accept', 'revert')),
  source TEXT,                                   -- 'ai_suggested' | 'manual' (from override row)
  previous_value JSONB,                          -- value before this action (NULL for first accept)
  new_value JSONB,                               -- value after this action (NULL for revert)
  ai_model TEXT,
  ai_rationale TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Useful for the audit panel: most recent first per user, narrow by case/field.
CREATE INDEX idx_case_meta_override_audit_user_created
  ON public.case_meta_override_audit (user_id, created_at DESC);
CREATE INDEX idx_case_meta_override_audit_case_field
  ON public.case_meta_override_audit (case_key, field, created_at DESC);

ALTER TABLE public.case_meta_override_audit ENABLE ROW LEVEL SECURITY;

-- Users see only their own audit entries.
CREATE POLICY "Users view own case_meta_override_audit"
  ON public.case_meta_override_audit
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users insert only entries attributed to themselves.
CREATE POLICY "Users insert own case_meta_override_audit"
  ON public.case_meta_override_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- The audit log is append-only by design: no UPDATE / DELETE policies.
