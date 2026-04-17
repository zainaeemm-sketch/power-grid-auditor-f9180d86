
-- 1. Create app_role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Security definer function to check role (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS on user_roles: users can view their own, admins can manage all
CREATE POLICY "Users view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Add is_public flag to ground_truth_scenarios
ALTER TABLE public.ground_truth_scenarios
  ADD COLUMN is_public boolean NOT NULL DEFAULT false;

-- 4. Replace RLS policies on ground_truth_scenarios
DROP POLICY IF EXISTS "Users view own ground_truth_scenarios" ON public.ground_truth_scenarios;
DROP POLICY IF EXISTS "Users insert own ground_truth_scenarios" ON public.ground_truth_scenarios;
DROP POLICY IF EXISTS "Users update own ground_truth_scenarios" ON public.ground_truth_scenarios;
DROP POLICY IF EXISTS "Users delete own ground_truth_scenarios" ON public.ground_truth_scenarios;

-- Anyone authenticated can read public scenarios OR their own
CREATE POLICY "View own or public scenarios"
  ON public.ground_truth_scenarios FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_public = true);

-- Insert: must be your own; only admins can create public ones
CREATE POLICY "Insert own scenarios"
  ON public.ground_truth_scenarios FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (is_public = false OR public.has_role(auth.uid(), 'admin'))
  );

-- Update: owner can update own (but cannot set is_public=true unless admin); admins can update any
CREATE POLICY "Update own or admin scenarios"
  ON public.ground_truth_scenarios FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (
    (auth.uid() = user_id AND (is_public = false OR public.has_role(auth.uid(), 'admin')))
    OR public.has_role(auth.uid(), 'admin')
  );

-- Delete: owner or admin
CREATE POLICY "Delete own or admin scenarios"
  ON public.ground_truth_scenarios FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 5. Update ground_truth_actions RLS to follow parent (view public too; write only if user owns parent OR parent is public AND user is admin)
DROP POLICY IF EXISTS "Users view own ground_truth_actions" ON public.ground_truth_actions;
DROP POLICY IF EXISTS "Users insert own ground_truth_actions" ON public.ground_truth_actions;
DROP POLICY IF EXISTS "Users update own ground_truth_actions" ON public.ground_truth_actions;
DROP POLICY IF EXISTS "Users delete own ground_truth_actions" ON public.ground_truth_actions;

CREATE POLICY "View actions of viewable scenarios"
  ON public.ground_truth_actions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ground_truth_scenarios s
    WHERE s.id = ground_truth_actions.scenario_id
      AND (s.user_id = auth.uid() OR s.is_public = true)
  ));

CREATE POLICY "Insert actions on writable scenarios"
  ON public.ground_truth_actions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ground_truth_scenarios s
    WHERE s.id = ground_truth_actions.scenario_id
      AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "Update actions on writable scenarios"
  ON public.ground_truth_actions FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ground_truth_scenarios s
    WHERE s.id = ground_truth_actions.scenario_id
      AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ground_truth_scenarios s
    WHERE s.id = ground_truth_actions.scenario_id
      AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "Delete actions on writable scenarios"
  ON public.ground_truth_actions FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ground_truth_scenarios s
    WHERE s.id = ground_truth_actions.scenario_id
      AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));
