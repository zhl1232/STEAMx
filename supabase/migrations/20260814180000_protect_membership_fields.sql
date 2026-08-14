-- Lock membership_* so users cannot promote themselves.
-- Admin writes go through admin_set_membership (SECURITY DEFINER).

CREATE OR REPLACE FUNCTION public.protect_profiles_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin') THEN
    NEW.role := OLD.role;
    NEW.xp := COALESCE(OLD.xp, 0);
    NEW.coins := COALESCE(OLD.coins, 0);
    NEW.last_check_in := OLD.last_check_in;
    NEW.login_streak := COALESCE(OLD.login_streak, 0);
    NEW.total_login_days := COALESCE(OLD.total_login_days, 0);
    NEW.age_confirmed_at := OLD.age_confirmed_at;
    NEW.interaction_restricted := OLD.interaction_restricted;
    NEW.membership_tier := OLD.membership_tier;
    NEW.membership_period := OLD.membership_period;
    NEW.membership_started_at := OLD.membership_started_at;
    NEW.membership_expires_at := OLD.membership_expires_at;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_membership(
  p_target_user_id uuid,
  p_period text,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_role text;
  v_now timestamptz := now();
  v_tier text;
  v_period text;
  v_started_at timestamptz;
  v_expires_at timestamptz;
  v_user jsonb;
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_admin_id;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF p_target_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_params');
  END IF;

  IF p_period = 'none' THEN
    v_tier := 'free';
    v_period := 'none';
    v_started_at := NULL;
    v_expires_at := NULL;
  ELSIF p_period = 'founder' THEN
    v_tier := 'founder';
    v_period := 'founder';
    v_started_at := v_now;
    v_expires_at := NULL;
  ELSIF p_period = 'lifetime' THEN
    v_tier := 'pro';
    v_period := 'lifetime';
    v_started_at := v_now;
    v_expires_at := NULL;
  ELSIF p_period IN ('monthly', 'yearly') THEN
    IF p_expires_at IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_expiry');
    END IF;
    IF p_expires_at <= v_now THEN
      RETURN jsonb_build_object('ok', false, 'error', 'expiry_in_past');
    END IF;
    v_tier := 'pro';
    v_period := p_period;
    v_started_at := v_now;
    v_expires_at := p_expires_at;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_period');
  END IF;

  UPDATE public.profiles
  SET
    membership_tier = v_tier,
    membership_period = v_period,
    membership_started_at = v_started_at,
    membership_expires_at = v_expires_at,
    updated_at = v_now
  WHERE id = p_target_user_id
  RETURNING jsonb_build_object(
    'id', id,
    'membership_tier', membership_tier,
    'membership_period', membership_period,
    'membership_started_at', membership_started_at,
    'membership_expires_at', membership_expires_at
  ) INTO v_user;

  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true, 'user', v_user);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_membership(uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_membership(uuid, text, timestamptz) TO authenticated;

COMMENT ON FUNCTION public.admin_set_membership(uuid, text, timestamptz)
  IS 'Admin-only membership write path; bypasses protect_profiles_sensitive_fields.';

NOTIFY pgrst, 'reload schema';
