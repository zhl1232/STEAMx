-- Allow an admin to review their own authored project. An optional note is
-- preserved in the audit reason when supplied. Moderators remain blocked from
-- self-review. The original function
-- intentionally rejected every self-review, so this replaces only its body
-- while keeping the same signature and grants.

CREATE OR REPLACE FUNCTION public.review_content_classification(
  p_content_type text,
  p_content_id bigint,
  p_expected_revision bigint,
  p_decision text,
  p_min_age smallint,
  p_max_age smallint,
  p_support_level text,
  p_difficulty_stars smallint,
  p_note text,
  p_idempotency_key uuid,
  p_reviewer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_table text;
  v_content_type text := lower(trim(p_content_type));
  v_decision text := lower(trim(p_decision));
  v_previous jsonb;
  v_new jsonb;
  v_existing jsonb;
  v_revision bigint;
  v_reviewer_id uuid := COALESCE(auth.uid(), p_reviewer_id);
  v_reviewer_role text;
  v_author_id uuid;
  v_self_review_override boolean := false;
BEGIN
  IF NOT public.is_moderator_or_admin()
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() IS NOT NULL AND p_reviewer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Reviewer must come from the authenticated session' USING ERRCODE = '42501';
  END IF;

  SELECT reviewer.role
    INTO v_reviewer_role
    FROM public.profiles AS reviewer
   WHERE reviewer.id = v_reviewer_id;

  IF v_reviewer_id IS NULL OR v_reviewer_role NOT IN ('moderator', 'admin') THEN
    RAISE EXCEPTION 'Reviewer must be a moderator or admin' USING ERRCODE = '42501';
  END IF;
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'idempotency_key is required' USING ERRCODE = '22023';
  END IF;
  IF v_content_type NOT IN ('course', 'project', 'challenge') THEN
    RAISE EXCEPTION 'Invalid content type' USING ERRCODE = '22023';
  END IF;
  IF v_decision NOT IN ('approve', 'return') THEN
    RAISE EXCEPTION 'Invalid review decision' USING ERRCODE = '22023';
  END IF;

  v_table := CASE v_content_type
    WHEN 'course' THEN 'courses'
    WHEN 'project' THEN 'projects'
    ELSE 'challenges'
  END;

  PERFORM pg_advisory_xact_lock(hashtext(format('content-classification:%s:%s', v_content_type, p_content_id)));

  SELECT jsonb_build_object(
    'alreadyProcessed', true,
    'decision', review.decision,
    'newClassification', review.new_value
  ) INTO v_existing
  FROM public.content_classification_reviews AS review
  WHERE review.content_type = v_content_type
    AND review.content_id = p_content_id
    AND review.idempotency_key = p_idempotency_key
  ORDER BY review.created_at
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  EXECUTE format(
    'SELECT to_jsonb(content), content.classification_revision
       FROM public.%I AS content
      WHERE content.id = $1
      FOR UPDATE',
    v_table
  ) INTO v_previous, v_revision USING p_content_id;

  IF v_previous IS NULL THEN
    RAISE EXCEPTION 'Content not found' USING ERRCODE = 'P0002';
  END IF;
  IF COALESCE(v_revision, 0) IS DISTINCT FROM COALESCE(p_expected_revision, 0) THEN
    RAISE EXCEPTION 'CLASSIFICATION_STALE' USING ERRCODE = 'P0001';
  END IF;

  IF v_content_type = 'project' THEN
    v_author_id := NULLIF(v_previous ->> 'author_id', '')::uuid;
    IF v_author_id IS NOT NULL AND v_author_id = v_reviewer_id THEN
      IF v_reviewer_role = 'admin' THEN
        v_self_review_override := true;
      ELSE
        RAISE EXCEPTION 'SELF_REVIEW_FORBIDDEN'
          USING ERRCODE = '42501',
                DETAIL = 'Moderators cannot review content they authored.';
      END IF;
    END IF;
  END IF;

  IF p_min_age IS NOT NULL AND (p_min_age < 3 OR p_min_age > 16) THEN
    RAISE EXCEPTION 'Invalid recommended_min_age' USING ERRCODE = '22023';
  END IF;
  IF p_max_age IS NOT NULL AND (
    p_min_age IS NULL OR p_max_age < p_min_age OR p_max_age > 16
  ) THEN
    RAISE EXCEPTION 'Invalid recommended_max_age' USING ERRCODE = '22023';
  END IF;
  IF p_support_level IS NULL OR p_support_level NOT IN ('independent', 'guided', 'adult_required') THEN
    RAISE EXCEPTION 'support_level is required' USING ERRCODE = '22023';
  END IF;
  IF p_difficulty_stars IS NULL OR p_difficulty_stars < 1 OR p_difficulty_stars > 6 THEN
    RAISE EXCEPTION 'difficulty_stars must be between 1 and 6' USING ERRCODE = '22023';
  END IF;
  PERFORM public.begin_content_classification_context('review');

  IF v_decision = 'approve' THEN
    EXECUTE format(
      'UPDATE public.%I AS content
          SET recommended_min_age = $1,
              recommended_max_age = $2,
              support_level = $3,
              difficulty_stars = $4,
              classification_status = ''reviewed'',
              classification_source = ''manual'',
              classification_reviewed_at = now(),
              classification_reviewed_by = $5
        WHERE content.id = $6
        RETURNING to_jsonb(content)',
      v_table
    ) INTO v_new USING p_min_age, p_max_age, p_support_level, p_difficulty_stars, v_reviewer_id, p_content_id;
  ELSE
    EXECUTE format(
      'UPDATE public.%I AS content
          SET recommended_min_age = $1,
              recommended_max_age = $2,
              support_level = $3,
              difficulty_stars = $4,
              classification_status = ''unreviewed'',
              classification_source = ''rules_v1'',
              classification_reviewed_at = NULL,
              classification_reviewed_by = NULL
        WHERE content.id = $5
        RETURNING to_jsonb(content)',
      v_table
    ) INTO v_new USING p_min_age, p_max_age, p_support_level, p_difficulty_stars, p_content_id;
  END IF;

  INSERT INTO public.content_classification_reviews (
    content_type,
    content_id,
    decision,
    previous_value,
    new_value,
    reason,
    actor_type,
    actor_id,
    idempotency_key
  ) VALUES (
    v_content_type,
    p_content_id,
    v_decision,
    v_previous,
    v_new,
    CASE
      WHEN v_self_review_override THEN COALESCE(
        'self_review_override: ' || NULLIF(trim(p_note), ''),
        'self_review_override'
      )
      ELSE COALESCE(NULLIF(trim(p_note), ''), CASE WHEN v_decision = 'approve' THEN 'manual_review' ELSE 'returned_for_revision' END)
    END,
    'user',
    v_reviewer_id,
    p_idempotency_key
  );

  RETURN jsonb_build_object(
    'alreadyProcessed', false,
    'contentType', v_content_type,
    'contentId', p_content_id,
    'decision', v_decision,
    'selfReviewOverride', v_self_review_override,
    'classification', jsonb_build_object(
      'recommendedMinAge', v_new -> 'recommended_min_age',
      'recommendedMaxAge', v_new -> 'recommended_max_age',
      'supportLevel', v_new -> 'support_level',
      'difficultyStars', v_new -> 'difficulty_stars',
      'status', v_new -> 'classification_status',
      'source', v_new -> 'classification_source',
      'reviewedAt', v_new -> 'classification_reviewed_at',
      'reviewedBy', v_new -> 'classification_reviewed_by',
      'revision', v_new -> 'classification_revision'
    )
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
