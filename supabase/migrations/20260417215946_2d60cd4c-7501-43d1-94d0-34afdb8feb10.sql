
-- 1. user_approvals table
CREATE TABLE public.user_approvals (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  email text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text
);

ALTER TABLE public.user_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own approval"
  ON public.user_approvals FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update approvals"
  ON public.user_approvals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert approvals"
  ON public.user_approvals FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Trigger to auto-create pending row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_approvals (user_id, email, status)
  VALUES (NEW.id, NEW.email, 'pending')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_approval ON auth.users;
CREATE TRIGGER on_auth_user_created_approval
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_approval();

-- 3. is_user_approved helper
CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_approvals
    WHERE user_id = _user_id AND status = 'approved'
  ) OR public.has_role(_user_id, 'admin');
$$;

-- 4. Backfill existing users as approved
INSERT INTO public.user_approvals (user_id, email, status, reviewed_at)
SELECT id, COALESCE(email, ''), 'approved', now()
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 5. Bootstrap admin role for zain.naeem@unipa.it
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'zain.naeem@unipa.it'
ON CONFLICT DO NOTHING;
