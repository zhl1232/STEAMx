-- Simplify interaction eligibility to registration + explicit self age confirmation.
-- XP is still a growth signal, but browser input must never determine an award.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS interaction_restricted boolean NOT NULL DEFAULT false;

-- Values written by the old signup/SMS flow were not age confirmations.
UPDATE public.profiles
SET age_confirmed_at = NULL
WHERE age_confirmed_at IS NOT NULL;

-- Registration and SMS verification prove account/phone control only.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  default_avatar text;
  requested_display_name text;
  requested_display_digits text;
  phone_digits text;
  safe_display_name text;
BEGIN
  default_avatar := '/avatars/default-' || (1 + (abs(hashtext(new.id::text)) % 12)) || '.svg';
  requested_display_name := NULLIF(btrim(new.raw_user_meta_data->>'full_name'), '');
  requested_display_digits := regexp_replace(COALESCE(requested_display_name, ''), '\D', '', 'g');
  phone_digits := regexp_replace(COALESCE(new.phone, ''), '\D', '', 'g');

  IF requested_display_name IS NULL
    OR (
      new.phone IS NOT NULL
      AND length(requested_display_digits) >= 11
      AND (
        requested_display_digits = phone_digits
        OR right(phone_digits, length(requested_display_digits)) = requested_display_digits
        OR right(requested_display_digits, length(phone_digits)) = phone_digits
      )
    )
  THEN
    safe_display_name := '新用户' || upper(substr(md5(gen_random_uuid()::text), 1, 4));
  ELSE
    safe_display_name := requested_display_name;
  END IF;

  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(
      NULLIF(btrim(new.raw_user_meta_data->>'username'), ''),
      'user_' || substr(md5(gen_random_uuid()::text), 1, 8)
    ),
    safe_display_name,
    default_avatar
  );
  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user()
IS '创建新用户 profile；手机号验证不等同于本人年龄确认';

-- Keep confirmation and restriction fields outside ordinary profile edits.
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
  END IF;
  RETURN NEW;
END;
$$;

-- The only user-facing write path for age confirmation.
CREATE OR REPLACE FUNCTION public.confirm_my_age()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  confirmed_at timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.profiles
  SET age_confirmed_at = COALESCE(age_confirmed_at, confirmed_at),
      updated_at = confirmed_at
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  SELECT age_confirmed_at
  INTO confirmed_at
  FROM public.profiles
  WHERE id = auth.uid();

  RETURN confirmed_at;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_my_age() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_my_age() TO authenticated;

-- Fixed server-side award table. The browser can no longer submit an amount,
-- action type, or resource id to obtain XP.
CREATE OR REPLACE FUNCTION public.award_xp_once(
  p_user_id uuid,
  p_action_type text,
  p_resource_id text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  award_amount integer;
  inserted_amount integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'award_xp_once is service-role only';
  END IF;

  IF p_user_id IS NULL OR NULLIF(btrim(p_resource_id), '') IS NULL THEN
    RAISE EXCEPTION 'Award user and resource are required';
  END IF;

  award_amount := CASE p_action_type
    WHEN 'publish_project' THEN 50
    WHEN 'comment_project' THEN 1
    WHEN 'like_project' THEN 1
    WHEN 'join_challenge' THEN 10
    WHEN 'submit_observation' THEN 10
    WHEN 'complete_challenge' THEN 20
    WHEN 'challenge_participation' THEN 20
    WHEN 'complete_project' THEN 20
    WHEN 'publish_course_work' THEN 20
    WHEN 'weekly_goal_comments_5' THEN 5
    ELSE NULL
  END;

  IF award_amount IS NULL THEN
    RAISE EXCEPTION 'Unsupported XP action: %', p_action_type;
  END IF;

  INSERT INTO public.xp_logs (user_id, action_type, resource_id, xp_amount)
  VALUES (p_user_id, p_action_type, btrim(p_resource_id), award_amount)
  ON CONFLICT (user_id, action_type, resource_id) DO NOTHING
  RETURNING xp_amount INTO inserted_amount;

  IF inserted_amount IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.profiles
  SET xp = COALESCE(xp, 0) + inserted_amount
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile for user % not found', p_user_id;
  END IF;

  RETURN inserted_amount;
END;
$$;

REVOKE ALL ON FUNCTION public.award_xp_once(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_xp_once(uuid, text, text) TO service_role;

COMMENT ON FUNCTION public.award_xp_once(uuid, text, text)
IS 'Atomic, idempotent XP award with a server-owned action-to-amount map';
