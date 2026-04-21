-- Seed built-in stressed-scenario presets for every existing user, and auto-seed for new users.

CREATE OR REPLACE FUNCTION public.seed_stressed_presets_for_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- case30 branch overload
  INSERT INTO public.experiment_presets (
    user_id, name, evaluation_mode, default_prompt_text, notes
  )
  SELECT
    _user_id,
    '[Stressed] case30 — branch overload',
    'simulation',
    'case30 is operating with branch 6→8 (rated 16 MW) overloaded by ~25% under current dispatch. Propose a single corrective action — either redispatch a generator (set_generator_p_mw on gen index 1 or 2), scale all loads by 0.90–0.95, or open a parallel branch — to bring all line loadings ≤ 100% of rating.',
    'Built-in stressed scenario. Case: case30. Pre-fills task with a known overload contingency to produce non-zero baseline violations.'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.experiment_presets
    WHERE user_id = _user_id AND name = '[Stressed] case30 — branch overload'
  );

  -- case14 line outage N-1
  INSERT INTO public.experiment_presets (
    user_id, name, evaluation_mode, default_prompt_text, notes
  )
  SELECT
    _user_id,
    '[Stressed] case14 — line outage N-1',
    'simulation',
    'case14 has just lost line index 6 (bus 3→4) due to an N-1 contingency. The system is post-trip and several remaining branches are at or above their thermal rating. Propose a single recovery action — scale_all_loads (0.85–0.95), set_generator_p_mw on gens 0 or 1, or further selective line_outage — to restore feasibility (all branches ≤ 100% rated).',
    'Built-in stressed scenario. Case: case14. N-1 contingency forces rerouting through weaker parallel paths.'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.experiment_presets
    WHERE user_id = _user_id AND name = '[Stressed] case14 — line outage N-1'
  );

  -- case30 peak demand spike
  INSERT INTO public.experiment_presets (
    user_id, name, evaluation_mode, default_prompt_text, notes
  )
  SELECT
    _user_id,
    '[Stressed] case30 — peak demand spike',
    'simulation',
    'case30 is experiencing a system-wide demand spike (+15% on all loads). Several generators are approaching or exceeding their P_max limits and one branch is overloaded. Propose a single action — scale_all_loads (0.85–0.92) to shed demand, or set_generator_p_mw to redispatch within limits — to eliminate all violations.',
    'Built-in stressed scenario. Case: case30. +15% load spike binds generator P_max limits.'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.experiment_presets
    WHERE user_id = _user_id AND name = '[Stressed] case30 — peak demand spike'
  );
END;
$$;

-- Backfill for existing users
DO $$
DECLARE
  u RECORD;
BEGIN
  FOR u IN SELECT id FROM auth.users LOOP
    PERFORM public.seed_stressed_presets_for_user(u.id);
  END LOOP;
END $$;

-- Auto-seed for newly created users
CREATE OR REPLACE FUNCTION public.handle_new_user_seed_presets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_stressed_presets_for_user(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_seed_presets ON auth.users;
CREATE TRIGGER on_auth_user_created_seed_presets
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_seed_presets();