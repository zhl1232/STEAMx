-- Keep the profile safety projection in sync with safety_actions.
-- The profiles protection trigger intentionally blocks ordinary clients from
-- changing interaction_restricted, so this privileged projection must run as
-- SECURITY DEFINER rather than through a service-role PostgREST UPDATE.

CREATE OR REPLACE FUNCTION public.sync_safety_projection(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_time_value timestamptz := now();
  has_ban boolean := false;
  has_suspension boolean := false;
  has_restriction boolean := false;
  latest_end timestamptz;
  latest_reason text;
BEGIN
  UPDATE public.safety_actions
  SET status = 'expired'
  WHERE user_id = p_user_id
    AND status = 'active'
    AND ends_at IS NOT NULL
    AND ends_at <= current_time_value;

  SELECT
    COALESCE(bool_or(action_type = 'account_ban'), false),
    COALESCE(bool_or(action_type = 'account_suspension'), false),
    COALESCE(bool_or(action_type IN ('interaction_restriction', 'account_suspension', 'account_ban')), false),
    max(ends_at) FILTER (WHERE action_type IN ('interaction_restriction', 'account_suspension', 'account_ban'))
  INTO has_ban, has_suspension, has_restriction, latest_end
  FROM public.safety_actions
  WHERE user_id = p_user_id
    AND status = 'active'
    AND (ends_at IS NULL OR ends_at > current_time_value);

  SELECT reason
  INTO latest_reason
  FROM public.safety_actions
  WHERE user_id = p_user_id
    AND status = 'active'
    AND action_type IN ('interaction_restriction', 'account_suspension', 'account_ban')
    AND (ends_at IS NULL OR ends_at > current_time_value)
  ORDER BY created_at DESC
  LIMIT 1;

  UPDATE public.profiles
  SET safety_status = CASE
        WHEN has_ban THEN 'banned'
        WHEN has_suspension THEN 'suspended'
        ELSE 'active'
      END,
      interaction_restricted = has_restriction,
      safety_restricted_until = latest_end,
      safety_restriction_reason = latest_reason
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_safety_projection(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_safety_projection(uuid) TO service_role;

-- Repair projections created before this function existed, including rows
-- whose interaction_restricted update was blocked by the profile trigger.
DO $$
DECLARE
  profile_row record;
BEGIN
  FOR profile_row IN SELECT id FROM public.profiles LOOP
    PERFORM public.sync_safety_projection(profile_row.id);
  END LOOP;
END;
$$;
