-- Repair legacy moderation helpers after the global search_path hardening.
-- These RPCs predate the tracked migrations and still called the moderator
-- helper without its schema qualifier after search_path was set to ''.

CREATE OR REPLACE FUNCTION public.is_moderator_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('moderator', 'admin')
  );
$$;

-- Public read policies call this helper for anonymous readers. The helper only
-- returns a role boolean, so anonymous execution is safe and avoids turning a
-- filtered public read into a permission error.
REVOKE ALL ON FUNCTION public.is_moderator_or_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_moderator_or_admin() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.approve_project(project_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_moderator_or_admin() THEN
    RAISE EXCEPTION 'Permission denied: only moderators and admins can approve projects';
  END IF;

  UPDATE public.projects
  SET
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    rejection_reason = NULL
  WHERE public.projects.id = project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_project(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_project(bigint) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reject_project(project_id bigint, reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_moderator_or_admin() THEN
    RAISE EXCEPTION 'Permission denied: only moderators and admins can reject projects';
  END IF;

  UPDATE public.projects
  SET
    status = 'rejected',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    rejection_reason = reason
  WHERE public.projects.id = project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_project(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_project(bigint, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reject_completion(completion_id bigint, reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_moderator_or_admin() THEN
    RAISE EXCEPTION 'Permission denied: only moderators and admins can reject completions';
  END IF;

  UPDATE public.completed_projects
  SET
    status = 'rejected',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    rejection_reason = reason
  WHERE public.completed_projects.id = completion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Completion % not found', completion_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_completion(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_completion(bigint, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.log_moderator_action(
  p_action_type text,
  p_target_type text,
  p_target_id bigint,
  p_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_moderator_or_admin() THEN
    RAISE EXCEPTION 'Permission denied: only moderators and admins can log actions';
  END IF;

  INSERT INTO public.moderator_actions (
    moderator_id,
    action_type,
    target_type,
    target_id,
    reason,
    metadata
  ) VALUES (
    auth.uid(),
    p_action_type,
    p_target_type,
    p_target_id,
    p_reason,
    p_metadata
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_moderator_action(text, text, bigint, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_moderator_action(text, text, bigint, text, jsonb) TO authenticated, service_role;
