CREATE OR REPLACE FUNCTION public.review_moderator_application(
  p_application_id bigint,
  p_action text,
  p_rejection_reason text DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  status text,
  user_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application public.moderator_applications%ROWTYPE;
  v_applicant_role text;
  v_trimmed_reason text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Permission denied: admin role required' USING ERRCODE = '42501';
  END IF;

  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid action' USING ERRCODE = '22023';
  END IF;

  v_trimmed_reason := NULLIF(BTRIM(COALESCE(p_rejection_reason, '')), '');

  IF p_action = 'reject' AND v_trimmed_reason IS NULL THEN
    RAISE EXCEPTION 'Rejection reason is required when rejecting an application'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.moderator_applications
  SET
    status = CASE
      WHEN p_action = 'approve' THEN 'approved'
      ELSE 'rejected'
    END,
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    rejection_reason = CASE
      WHEN p_action = 'reject' THEN v_trimmed_reason
      ELSE NULL
    END,
    updated_at = NOW()
  WHERE moderator_applications.id = p_application_id
    AND moderator_applications.status = 'pending'
  RETURNING * INTO v_application;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found or already reviewed' USING ERRCODE = 'P0002';
  END IF;

  IF p_action = 'approve' THEN
    SELECT profiles.role
    INTO v_applicant_role
    FROM public.profiles
    WHERE profiles.id = v_application.user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Applicant profile not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_applicant_role <> 'user' THEN
      RAISE EXCEPTION 'Applicant role changed and can no longer be approved'
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.profiles
    SET
      role = 'moderator',
      updated_at = NOW()
    WHERE profiles.id = v_application.user_id;
  END IF;

  RETURN QUERY
  SELECT
    v_application.id,
    v_application.status,
    v_application.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.review_moderator_application(bigint, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_moderator_application(bigint, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_moderator_application(bigint, text, text) TO service_role;
