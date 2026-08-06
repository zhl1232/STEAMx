-- Private messaging has its own safety controls: authentication, account
-- restrictions, blocks, recipient privacy, rate limits, and moderation.
-- Do not use the public-content rules acknowledgement as a DM prerequisite.

CREATE OR REPLACE FUNCTION public.current_user_can_interact(p_capability text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  IF current_user_id IS NULL OR p_capability NOT IN ('post', 'comment', 'submit', 'message', 'engage', 'save_progress') THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = current_user_id
      AND p.safety_status <> 'banned'
      AND (
        p.interaction_restricted IS NOT TRUE
        OR (p.safety_restricted_until IS NOT NULL AND p.safety_restricted_until <= now())
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.safety_actions sa
        WHERE sa.user_id = current_user_id
          AND sa.status = 'active'
          AND sa.action_type IN ('interaction_restriction', 'account_suspension', 'account_ban')
          AND (sa.ends_at IS NULL OR sa.ends_at > now())
      )
      AND (
        p_capability IN ('engage', 'save_progress', 'message')
        OR p.age_confirmed_at IS NOT NULL
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_can_interact(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_interact(text) TO service_role;

NOTIFY pgrst, 'reload schema';
