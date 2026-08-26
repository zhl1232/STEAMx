-- Content classification phase 1: nullable fields, audit trail and review APIs.
--
-- This migration intentionally does not change the existing public visibility
-- policy or enable the publish gate. Both rollout switches remain false until
-- the preflight report and the first review pass are complete.

-- -----------------------------------------------------------------------------
-- 1. Shared nullable classification fields
-- -----------------------------------------------------------------------------

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS recommended_min_age smallint,
  ADD COLUMN IF NOT EXISTS recommended_max_age smallint,
  ADD COLUMN IF NOT EXISTS support_level varchar(24),
  ADD COLUMN IF NOT EXISTS classification_status varchar(16) NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS classification_source varchar(16),
  ADD COLUMN IF NOT EXISTS classification_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS classification_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS classification_revision bigint NOT NULL DEFAULT 0;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS recommended_min_age smallint,
  ADD COLUMN IF NOT EXISTS recommended_max_age smallint,
  ADD COLUMN IF NOT EXISTS support_level varchar(24),
  ADD COLUMN IF NOT EXISTS classification_status varchar(16) NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS classification_source varchar(16),
  ADD COLUMN IF NOT EXISTS classification_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS classification_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS classification_revision bigint NOT NULL DEFAULT 0;

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS recommended_min_age smallint,
  ADD COLUMN IF NOT EXISTS recommended_max_age smallint,
  ADD COLUMN IF NOT EXISTS support_level varchar(24),
  ADD COLUMN IF NOT EXISTS classification_status varchar(16) NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS classification_source varchar(16),
  ADD COLUMN IF NOT EXISTS classification_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS classification_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS classification_revision bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.courses.recommended_min_age IS '人工复核后的推荐起始年龄（3-16）；阶段 1 允许为空。';
COMMENT ON COLUMN public.courses.recommended_max_age IS 'NULL 表示 reviewed 内容没有设定年龄上限；unreviewed 时表示尚未确认。';
COMMENT ON COLUMN public.courses.support_level IS 'independent / guided / adult_required；阶段 1 允许为空。';
COMMENT ON COLUMN public.courses.classification_status IS 'unreviewed / reviewed；不代表内容安全审核状态。';
COMMENT ON COLUMN public.courses.classification_source IS 'rules_v1 仅为候选，manual 才是有效公开结论。';
COMMENT ON COLUMN public.courses.classification_revision IS '分级相关内容每次失效时递增，用于防止审核覆盖新编辑。';

COMMENT ON COLUMN public.projects.recommended_min_age IS '人工复核后的推荐起始年龄（3-16）；阶段 1 允许为空。';
COMMENT ON COLUMN public.projects.recommended_max_age IS 'NULL 表示 reviewed 内容没有设定年龄上限；unreviewed 时表示尚未确认。';
COMMENT ON COLUMN public.projects.support_level IS 'independent / guided / adult_required；阶段 1 允许为空。';
COMMENT ON COLUMN public.projects.classification_status IS 'unreviewed / reviewed；不代表内容安全审核状态。';
COMMENT ON COLUMN public.projects.classification_source IS 'rules_v1 仅为候选，manual 才是有效公开结论。';
COMMENT ON COLUMN public.projects.classification_revision IS '分级相关内容每次失效时递增，用于防止审核覆盖新编辑。';

COMMENT ON COLUMN public.challenges.recommended_min_age IS '人工复核后的推荐起始年龄（3-16）；阶段 1 允许为空。';
COMMENT ON COLUMN public.challenges.recommended_max_age IS 'NULL 表示 reviewed 内容没有设定年龄上限；unreviewed 时表示尚未确认。';
COMMENT ON COLUMN public.challenges.support_level IS 'independent / guided / adult_required；阶段 1 允许为空。';
COMMENT ON COLUMN public.challenges.classification_status IS 'unreviewed / reviewed；不代表内容安全审核状态。';
COMMENT ON COLUMN public.challenges.classification_source IS 'rules_v1 仅为候选，manual 才是有效公开结论。';
COMMENT ON COLUMN public.challenges.classification_revision IS '分级相关内容每次失效时递增，用于防止审核覆盖新编辑。';

-- NOT VALID keeps historical rows available while enforcing new/updated rows.
DO $$
DECLARE
  v_table regclass;
  v_constraint text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'public.courses'::regclass,
    'public.projects'::regclass,
    'public.challenges'::regclass
  ] LOOP
    v_constraint := CASE
      WHEN v_table = 'public.courses'::regclass THEN 'courses_classification_fields_valid'
      WHEN v_table = 'public.projects'::regclass THEN 'projects_classification_fields_valid'
      ELSE 'challenges_classification_fields_valid'
    END;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = v_table
        AND conname = v_constraint
    ) THEN
      EXECUTE format(
        'ALTER TABLE %s ADD CONSTRAINT %I CHECK (
          (recommended_min_age IS NULL OR recommended_min_age BETWEEN 3 AND 16)
          AND (recommended_max_age IS NULL OR (
            recommended_min_age IS NOT NULL
            AND recommended_max_age BETWEEN recommended_min_age AND 16
          ))
          AND (support_level IS NULL OR support_level IN (''independent'', ''guided'', ''adult_required''))
          AND classification_status IN (''unreviewed'', ''reviewed'')
          AND (classification_source IS NULL OR classification_source IN (''rules_v1'', ''manual''))
          AND classification_revision >= 0
        ) NOT VALID',
        v_table,
        v_constraint
      );
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE
  v_table regclass;
  v_constraint text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'public.courses'::regclass,
    'public.projects'::regclass,
    'public.challenges'::regclass
  ] LOOP
    v_constraint := CASE
      WHEN v_table = 'public.courses'::regclass THEN 'courses_classification_review_complete'
      WHEN v_table = 'public.projects'::regclass THEN 'projects_classification_review_complete'
      ELSE 'challenges_classification_review_complete'
    END;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = v_table
        AND conname = v_constraint
    ) THEN
      EXECUTE format(
        'ALTER TABLE %s ADD CONSTRAINT %I CHECK (
          classification_status <> ''reviewed'' OR (
            recommended_min_age IS NOT NULL
            AND support_level IN (''independent'', ''guided'', ''adult_required'')
            AND difficulty_stars BETWEEN 1 AND 6
            AND classification_source = ''manual''
            AND classification_reviewed_at IS NOT NULL
            AND classification_reviewed_by IS NOT NULL
          )
        ) NOT VALID',
        v_table,
        v_constraint
      );
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE
  v_table regclass;
  v_constraint text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'public.courses'::regclass,
    'public.projects'::regclass,
    'public.challenges'::regclass
  ] LOOP
    v_constraint := CASE
      WHEN v_table = 'public.courses'::regclass THEN 'courses_classification_reviewed_by_fkey'
      WHEN v_table = 'public.projects'::regclass THEN 'projects_classification_reviewed_by_fkey'
      ELSE 'challenges_classification_reviewed_by_fkey'
    END;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = v_table
        AND conname = v_constraint
    ) THEN
      EXECUTE format(
        'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (classification_reviewed_by)
          REFERENCES public.profiles(id) ON DELETE RESTRICT',
        v_table,
        v_constraint
      );
    END IF;
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Review history and rollout state
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.content_classification_reviews (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  content_type varchar(16) NOT NULL CHECK (content_type IN ('course', 'project', 'challenge')),
  content_id bigint NOT NULL,
  decision varchar(16) NOT NULL CHECK (decision IN ('candidate', 'approve', 'return', 'invalidate')),
  previous_value jsonb,
  new_value jsonb,
  reason text,
  actor_type varchar(16) NOT NULL CHECK (actor_type IN ('user', 'system', 'migration')),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  actor_label text,
  idempotency_key uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_classification_reviews_actor_valid CHECK (
    (actor_type = 'user' AND actor_id IS NOT NULL)
    OR (actor_type IN ('system', 'migration') AND NULLIF(actor_label, '') IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS content_classification_reviews_queue_idx
  ON public.content_classification_reviews (content_type, content_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS content_classification_reviews_idempotency_idx
  ON public.content_classification_reviews (content_type, content_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.content_classification_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  public_v1_enabled boolean NOT NULL DEFAULT false,
  enforcement_enabled boolean NOT NULL DEFAULT false,
  emergency_reason text,
  emergency_actor_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  enforcement_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT
);

INSERT INTO public.content_classification_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

-- A transaction-local capability table prevents a caller from forging the
-- trigger bypass with an arbitrary app.* GUC. Only the SECURITY DEFINER RPCs
-- and their child invalidation triggers can create a row; the row is consumed
-- by the corresponding content trigger before the transaction continues.
CREATE TABLE IF NOT EXISTS public.content_classification_operation_context (
  transaction_id bigint NOT NULL,
  operation_type varchar(16) NOT NULL CHECK (operation_type IN ('candidate', 'review', 'invalidation')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (transaction_id, operation_type)
);

REVOKE ALL ON public.content_classification_operation_context FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.content_classification_rollout_events (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  event_type varchar(32) NOT NULL CHECK (event_type IN ('rollout_enabled', 'emergency_disabled', 'auto_restored')),
  actor_type varchar(16) NOT NULL CHECK (actor_type IN ('user', 'system', 'migration')),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reason text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_classification_rollout_actor_valid CHECK (
    (actor_type = 'user' AND actor_id IS NOT NULL)
    OR (actor_type IN ('system', 'migration') AND NULLIF(reason, '') IS NOT NULL)
  )
);

ALTER TABLE public.content_classification_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_classification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_classification_rollout_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_classification_reviews_staff_select ON public.content_classification_reviews;
CREATE POLICY content_classification_reviews_staff_select
  ON public.content_classification_reviews
  FOR SELECT
  USING (public.is_moderator_or_admin());

DROP POLICY IF EXISTS content_classification_rollout_staff_select ON public.content_classification_rollout_events;
CREATE POLICY content_classification_rollout_staff_select
  ON public.content_classification_rollout_events
  FOR SELECT
  USING (public.is_moderator_or_admin());

REVOKE ALL ON public.content_classification_settings FROM anon, authenticated;
REVOKE ALL ON public.content_classification_rollout_events FROM anon, authenticated;
REVOKE ALL ON public.content_classification_reviews FROM anon, authenticated;
GRANT SELECT ON public.content_classification_reviews TO authenticated;
GRANT SELECT ON public.content_classification_rollout_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.content_classification_settings TO service_role;
GRANT SELECT ON public.content_classification_reviews, public.content_classification_rollout_events TO service_role;

-- Direct clients cannot forge review metadata. Candidate values are written by
-- the candidate RPC below; normal content writes remain available and are
-- invalidated by the trigger.
REVOKE INSERT (
  classification_status,
  classification_source,
  classification_reviewed_at,
  classification_reviewed_by,
  classification_revision
) ON public.courses, public.projects, public.challenges FROM anon, authenticated, service_role;

REVOKE UPDATE (
  classification_status,
  classification_source,
  classification_reviewed_at,
  classification_reviewed_by,
  classification_revision
) ON public.courses, public.projects, public.challenges FROM anon, authenticated, service_role;

REVOKE UPDATE, DELETE ON public.content_classification_reviews FROM anon, authenticated, service_role;
REVOKE INSERT ON public.content_classification_reviews FROM anon, authenticated, service_role;
REVOKE UPDATE, DELETE, INSERT ON public.content_classification_rollout_events FROM anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Indexes used by phase 1 queues and phase 2 public filters
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS courses_classification_public_idx
  ON public.courses (status, classification_status, recommended_min_age);

CREATE INDEX IF NOT EXISTS projects_classification_public_idx
  ON public.projects (status, moderation_state, classification_status, recommended_min_age);

CREATE INDEX IF NOT EXISTS challenges_classification_public_idx
  ON public.challenges (status, classification_status, recommended_min_age);

CREATE INDEX IF NOT EXISTS courses_classification_queue_idx
  ON public.courses (classification_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS projects_classification_queue_idx
  ON public.projects (classification_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS challenges_classification_queue_idx
  ON public.challenges (classification_status, created_at DESC);

-- -----------------------------------------------------------------------------
-- 4. Invalidation trigger
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.content_classification_review_context()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN current_setting('app.content_classification_operation', true) = 'review'
     AND EXISTS (
       SELECT 1
         FROM public.content_classification_operation_context AS context
        WHERE context.transaction_id = pg_catalog.txid_current()
          AND context.operation_type = 'review'
     );
END;
$$;

CREATE OR REPLACE FUNCTION public.begin_content_classification_context(
  p_operation_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_operation_type NOT IN ('candidate', 'review', 'invalidation') THEN
    RAISE EXCEPTION 'Invalid content classification operation context' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.content_classification_operation', p_operation_type, true);
  INSERT INTO public.content_classification_operation_context (transaction_id, operation_type)
  VALUES (pg_catalog.txid_current(), p_operation_type)
  ON CONFLICT (transaction_id, operation_type) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_content_classification_context(
  p_operation_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_consumed boolean := false;
BEGIN
  DELETE FROM public.content_classification_operation_context
   WHERE transaction_id = pg_catalog.txid_current()
     AND operation_type = p_operation_type
  RETURNING true INTO v_consumed;

  RETURN COALESCE(v_consumed, false);
END;
$$;

-- Course lesson edits are a controlled invalidation path of their own. The
-- operation context is transaction-local and cannot be created by table
-- clients, so a normal service-role UPDATE cannot look like a lesson edit.
CREATE OR REPLACE FUNCTION public.content_classification_invalidation_context()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN current_setting('app.content_classification_operation', true) = 'invalidation'
     AND EXISTS (
       SELECT 1
         FROM public.content_classification_operation_context AS context
        WHERE context.transaction_id = pg_catalog.txid_current()
          AND context.operation_type = 'invalidation'
     );
END;
$$;

CREATE OR REPLACE FUNCTION public.content_classification_candidate_context()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN current_setting('app.content_classification_operation', true) = 'candidate'
     AND EXISTS (
       SELECT 1
         FROM public.content_classification_operation_context AS context
        WHERE context.transaction_id = pg_catalog.txid_current()
          AND context.operation_type = 'candidate'
     );
END;
$$;

CREATE OR REPLACE FUNCTION public.invalidate_content_classification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  v_new jsonb := to_jsonb(NEW);
  v_field text;
  v_changed boolean := false;
  v_review_context boolean := public.content_classification_review_context();
  v_candidate_context boolean := public.content_classification_candidate_context();
  v_invalidation_context boolean := public.content_classification_invalidation_context();
  v_content_type text := CASE TG_TABLE_NAME
    WHEN 'courses' THEN 'course'
    WHEN 'projects' THEN 'project'
    WHEN 'challenges' THEN 'challenge'
  END;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT v_review_context AND (
      NEW.classification_status = 'reviewed'
      OR NEW.classification_source = 'manual'
      OR NEW.classification_reviewed_at IS NOT NULL
      OR NEW.classification_reviewed_by IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'CLASSIFICATION_WRITE_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  FOREACH v_field IN ARRAY ARRAY[
    'title',
    'description',
    'content',
    'objective',
    'objectives',
    'constraints',
    'expected_outcome',
    'scenario',
    'driving_question',
    'materials',
    'project_materials',
    'steps',
    'project_steps',
    'stages',
    'resources',
    'tags',
    'difficulty',
    'difficulty_stars',
    'recommended_min_age',
    'recommended_max_age',
    'support_level'
  ] LOOP
    IF (v_old -> v_field) IS DISTINCT FROM (v_new -> v_field) THEN
      v_changed := true;
      EXIT;
    END IF;
  END LOOP;

  IF NOT v_review_context AND NOT v_candidate_context AND NOT v_invalidation_context AND NOT v_changed AND (
    (NEW.classification_status IS DISTINCT FROM OLD.classification_status AND NEW.classification_status = 'reviewed')
    OR (NEW.classification_source IS DISTINCT FROM OLD.classification_source AND NEW.classification_source = 'manual')
    OR NEW.classification_reviewed_at IS DISTINCT FROM OLD.classification_reviewed_at
    OR NEW.classification_reviewed_by IS DISTINCT FROM OLD.classification_reviewed_by
    OR NEW.classification_revision IS DISTINCT FROM OLD.classification_revision
  ) THEN
    RAISE EXCEPTION 'CLASSIFICATION_WRITE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  -- Candidate writes and course-lesson invalidation are controlled writes. The
  -- caller still has to pass the RPC/context checks above; this branch
  -- only prevents the trigger from recording a second invalidation event.
  IF NOT v_changed OR v_review_context OR v_candidate_context OR v_invalidation_context THEN
    IF v_review_context THEN
      PERFORM public.consume_content_classification_context('review');
    ELSIF v_candidate_context THEN
      PERFORM public.consume_content_classification_context('candidate');
    ELSIF v_invalidation_context THEN
      PERFORM public.consume_content_classification_context('invalidation');
    END IF;
    RETURN NEW;
  END IF;

  NEW.classification_status := 'unreviewed';
  NEW.classification_reviewed_at := NULL;
  NEW.classification_reviewed_by := NULL;
  NEW.classification_revision := COALESCE(OLD.classification_revision, 0) + 1;
  IF NOT v_candidate_context THEN
    NEW.classification_source := NULL;
  END IF;

  INSERT INTO public.content_classification_reviews (
    content_type,
    content_id,
    decision,
    previous_value,
    new_value,
    reason,
    actor_type,
    actor_label
  ) VALUES (
    v_content_type,
    NEW.id,
    'invalidate',
    jsonb_build_object(
      'recommendedMinAge', v_old -> 'recommended_min_age',
      'recommendedMaxAge', v_old -> 'recommended_max_age',
      'supportLevel', v_old -> 'support_level',
      'difficultyStars', v_old -> 'difficulty_stars',
      'status', v_old -> 'classification_status',
      'source', v_old -> 'classification_source',
      'revision', v_old -> 'classification_revision'
    ),
    jsonb_build_object(
      'recommendedMinAge', v_new -> 'recommended_min_age',
      'recommendedMaxAge', v_new -> 'recommended_max_age',
      'supportLevel', v_new -> 'support_level',
      'difficultyStars', v_new -> 'difficulty_stars',
      'status', 'unreviewed',
      'source', CASE WHEN v_candidate_context THEN 'rules_v1' ELSE NULL END,
      'revision', COALESCE(OLD.classification_revision, 0) + 1
    ),
    'content_changed',
    'system',
    'content-classification-invalidation-trigger'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS courses_content_classification_invalidation ON public.courses;
CREATE TRIGGER courses_content_classification_invalidation
  BEFORE INSERT OR UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_content_classification();

DROP TRIGGER IF EXISTS projects_content_classification_invalidation ON public.projects;
CREATE TRIGGER projects_content_classification_invalidation
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_content_classification();

DROP TRIGGER IF EXISTS challenges_content_classification_invalidation ON public.challenges;
CREATE TRIGGER challenges_content_classification_invalidation
  BEFORE INSERT OR UPDATE ON public.challenges
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_content_classification();

CREATE OR REPLACE FUNCTION public.invalidate_course_classification_from_lesson()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_course_id bigint;
  v_course_ids bigint[];
  v_previous jsonb;
  v_new jsonb;
BEGIN
  -- UPDATE OF course_id can affect both the old and new parent. Keep the
  -- operation serialized with review_content_classification().
  IF TG_OP = 'UPDATE' AND OLD.course_id IS DISTINCT FROM NEW.course_id THEN
    -- Always lock both parents in ascending order when a lesson moves. This
    -- matches the project-child trigger below and avoids opposite lock order
    -- under concurrent moves.
    v_course_ids := CASE
      WHEN OLD.course_id IS NULL THEN ARRAY[NEW.course_id]
      WHEN NEW.course_id IS NULL THEN ARRAY[OLD.course_id]
      WHEN OLD.course_id < NEW.course_id THEN ARRAY[OLD.course_id, NEW.course_id]
      ELSE ARRAY[NEW.course_id, OLD.course_id]
    END;
    FOREACH v_course_id IN ARRAY v_course_ids LOOP
      IF v_course_id IS NULL THEN CONTINUE; END IF;
      PERFORM pg_advisory_xact_lock(hashtext(format('content-classification:course:%s', v_course_id)));
      SELECT to_jsonb(course) INTO v_previous
        FROM public.courses AS course
       WHERE course.id = v_course_id
       FOR UPDATE;
      IF v_previous IS NULL THEN CONTINUE; END IF;

      PERFORM public.begin_content_classification_context('invalidation');
      UPDATE public.courses AS course
         SET classification_status = 'unreviewed',
             classification_source = NULL,
             classification_reviewed_at = NULL,
             classification_reviewed_by = NULL,
             classification_revision = COALESCE(course.classification_revision, 0) + 1
       WHERE course.id = v_course_id
       RETURNING to_jsonb(course) INTO v_new;

      INSERT INTO public.content_classification_reviews (
        content_type, content_id, decision, previous_value, new_value,
        reason, actor_type, actor_label
      ) VALUES (
        'course', v_course_id, 'invalidate',
        jsonb_build_object(
          'recommendedMinAge', v_previous -> 'recommended_min_age',
          'recommendedMaxAge', v_previous -> 'recommended_max_age',
          'supportLevel', v_previous -> 'support_level',
          'difficultyStars', v_previous -> 'difficulty_stars',
          'status', v_previous -> 'classification_status',
          'source', v_previous -> 'classification_source',
          'revision', v_previous -> 'classification_revision'
        ),
        jsonb_build_object(
          'recommendedMinAge', v_new -> 'recommended_min_age',
          'recommendedMaxAge', v_new -> 'recommended_max_age',
          'supportLevel', v_new -> 'support_level',
          'difficultyStars', v_new -> 'difficulty_stars',
          'status', 'unreviewed',
          'source', NULL,
          'revision', v_new -> 'classification_revision'
        ),
        'course_lesson_changed', 'system',
        'content-classification-lesson-invalidation-trigger'
      );
    END LOOP;

    RETURN NEW;
  END IF;

  v_course_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.course_id ELSE NEW.course_id END;
  IF v_course_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(format('content-classification:course:%s', v_course_id)));
    SELECT to_jsonb(course) INTO v_previous
      FROM public.courses AS course
     WHERE course.id = v_course_id
     FOR UPDATE;

    IF v_previous IS NOT NULL THEN
      PERFORM public.begin_content_classification_context('invalidation');
      UPDATE public.courses AS course
         SET classification_status = 'unreviewed',
             classification_source = NULL,
             classification_reviewed_at = NULL,
             classification_reviewed_by = NULL,
             classification_revision = COALESCE(course.classification_revision, 0) + 1
       WHERE course.id = v_course_id
       RETURNING to_jsonb(course) INTO v_new;

      INSERT INTO public.content_classification_reviews (
        content_type, content_id, decision, previous_value, new_value,
        reason, actor_type, actor_label
      ) VALUES (
        'course', v_course_id, 'invalidate',
        jsonb_build_object(
          'recommendedMinAge', v_previous -> 'recommended_min_age',
          'recommendedMaxAge', v_previous -> 'recommended_max_age',
          'supportLevel', v_previous -> 'support_level',
          'difficultyStars', v_previous -> 'difficulty_stars',
          'status', v_previous -> 'classification_status',
          'source', v_previous -> 'classification_source',
          'revision', v_previous -> 'classification_revision'
        ),
        jsonb_build_object(
          'recommendedMinAge', v_new -> 'recommended_min_age',
          'recommendedMaxAge', v_new -> 'recommended_max_age',
          'supportLevel', v_new -> 'support_level',
          'difficultyStars', v_new -> 'difficulty_stars',
          'status', 'unreviewed',
          'source', NULL,
          'revision', v_new -> 'classification_revision'
        ),
        'course_lesson_changed', 'system',
        'content-classification-lesson-invalidation-trigger'
      );
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS course_lessons_content_classification_invalidation ON public.course_lessons;
CREATE TRIGGER course_lessons_content_classification_invalidation
  AFTER INSERT OR UPDATE OR DELETE ON public.course_lessons
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_course_classification_from_lesson();

-- Project materials and steps live outside the projects row, but both are part
-- of the safety/complexity evidence used by classification. A child edit must
-- therefore clear the parent review in the same transaction. Parent ids are
-- processed in ascending order when a row is moved between projects so two
-- concurrent moves cannot acquire advisory locks in opposite order.
CREATE OR REPLACE FUNCTION public.invalidate_project_classification_parent(
  p_project_id bigint,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_previous jsonb;
  v_new jsonb;
BEGIN
  IF p_project_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(format('content-classification:project:%s', p_project_id)));

  SELECT to_jsonb(project) INTO v_previous
    FROM public.projects AS project
   WHERE project.id = p_project_id
   FOR UPDATE;

  IF v_previous IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.begin_content_classification_context('invalidation');
  UPDATE public.projects AS project
     SET classification_status = 'unreviewed',
         classification_source = NULL,
         classification_reviewed_at = NULL,
         classification_reviewed_by = NULL,
         classification_revision = COALESCE(project.classification_revision, 0) + 1
   WHERE project.id = p_project_id
   RETURNING to_jsonb(project) INTO v_new;

  INSERT INTO public.content_classification_reviews (
    content_type, content_id, decision, previous_value, new_value,
    reason, actor_type, actor_label
  ) VALUES (
    'project', p_project_id, 'invalidate',
    jsonb_build_object(
      'recommendedMinAge', v_previous -> 'recommended_min_age',
      'recommendedMaxAge', v_previous -> 'recommended_max_age',
      'supportLevel', v_previous -> 'support_level',
      'difficultyStars', v_previous -> 'difficulty_stars',
      'status', v_previous -> 'classification_status',
      'source', v_previous -> 'classification_source',
      'revision', v_previous -> 'classification_revision'
    ),
    jsonb_build_object(
      'recommendedMinAge', v_new -> 'recommended_min_age',
      'recommendedMaxAge', v_new -> 'recommended_max_age',
      'supportLevel', v_new -> 'support_level',
      'difficultyStars', v_new -> 'difficulty_stars',
      'status', 'unreviewed',
      'source', NULL,
      'revision', v_new -> 'classification_revision'
    ),
    COALESCE(NULLIF(p_reason, ''), 'project_child_changed'),
    'system',
    'content-classification-project-child-trigger'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.invalidate_project_classification_from_child()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_project_id bigint := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.project_id ELSE NULL END;
  v_new_project_id bigint := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.project_id ELSE NULL END;
BEGIN
  IF v_old_project_id IS NOT NULL
     AND v_new_project_id IS NOT NULL
     AND v_old_project_id IS DISTINCT FROM v_new_project_id THEN
    IF v_old_project_id < v_new_project_id THEN
      PERFORM public.invalidate_project_classification_parent(v_old_project_id, 'project_child_moved');
      PERFORM public.invalidate_project_classification_parent(v_new_project_id, 'project_child_moved');
    ELSE
      PERFORM public.invalidate_project_classification_parent(v_new_project_id, 'project_child_moved');
      PERFORM public.invalidate_project_classification_parent(v_old_project_id, 'project_child_moved');
    END IF;
  ELSE
    PERFORM public.invalidate_project_classification_parent(
      COALESCE(v_new_project_id, v_old_project_id),
      'project_child_changed'
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_materials_content_classification_invalidation ON public.project_materials;
CREATE TRIGGER project_materials_content_classification_invalidation
  AFTER INSERT OR UPDATE OR DELETE ON public.project_materials
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_project_classification_from_child();

DROP TRIGGER IF EXISTS project_steps_content_classification_invalidation ON public.project_steps;
CREATE TRIGGER project_steps_content_classification_invalidation
  AFTER INSERT OR UPDATE OR DELETE ON public.project_steps
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_project_classification_from_child();

REVOKE ALL ON FUNCTION public.invalidate_project_classification_parent(bigint, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.invalidate_project_classification_from_child() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.invalidate_content_classification() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.invalidate_course_classification_from_lesson() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.begin_content_classification_context(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.consume_content_classification_context(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.content_classification_review_context() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.content_classification_invalidation_context() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.content_classification_candidate_context() FROM PUBLIC, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. Candidate and review RPCs
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_content_classification_candidate(
  p_content_type text,
  p_content_id bigint,
  p_min_age smallint,
  p_max_age smallint,
  p_support_level text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_table text;
  v_previous jsonb;
  v_new jsonb;
  v_actor_id uuid := auth.uid();
  v_content_type text := lower(trim(p_content_type));
BEGIN
  IF NOT public.is_moderator_or_admin()
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_content_type NOT IN ('course', 'project', 'challenge') THEN
    RAISE EXCEPTION 'Invalid content type' USING ERRCODE = '22023';
  END IF;
  IF p_min_age IS NOT NULL AND (p_min_age < 3 OR p_min_age > 16) THEN
    RAISE EXCEPTION 'Invalid recommended_min_age' USING ERRCODE = '22023';
  END IF;
  IF p_max_age IS NOT NULL AND (
    p_min_age IS NULL OR p_max_age < p_min_age OR p_max_age > 16
  ) THEN
    RAISE EXCEPTION 'Invalid recommended_max_age' USING ERRCODE = '22023';
  END IF;
  IF p_support_level IS NOT NULL AND p_support_level NOT IN ('independent', 'guided', 'adult_required') THEN
    RAISE EXCEPTION 'Invalid support_level' USING ERRCODE = '22023';
  END IF;

  v_table := CASE v_content_type
    WHEN 'course' THEN 'courses'
    WHEN 'project' THEN 'projects'
    ELSE 'challenges'
  END;

  PERFORM pg_advisory_xact_lock(hashtext(format('content-classification:%s:%s', v_content_type, p_content_id)));
  PERFORM public.begin_content_classification_context('candidate');

  EXECUTE format(
    'SELECT to_jsonb(content) FROM public.%I AS content WHERE content.id = $1 FOR UPDATE',
    v_table
  ) INTO v_previous USING p_content_id;

  IF v_previous IS NULL THEN
    RAISE EXCEPTION 'Content not found' USING ERRCODE = 'P0002';
  END IF;

  EXECUTE format(
    'UPDATE public.%I AS content
        SET recommended_min_age = $1,
            recommended_max_age = $2,
            support_level = $3,
            classification_status = ''unreviewed'',
            classification_source = ''rules_v1'',
            classification_reviewed_at = NULL,
            classification_reviewed_by = NULL
      WHERE content.id = $4
      RETURNING to_jsonb(content)',
    v_table
  ) INTO v_new USING p_min_age, p_max_age, p_support_level, p_content_id;

  INSERT INTO public.content_classification_reviews (
    content_type,
    content_id,
    decision,
    previous_value,
    new_value,
    reason,
    actor_type,
    actor_id,
    actor_label
  ) VALUES (
    v_content_type,
    p_content_id,
    'candidate',
    v_previous,
    v_new,
    'rules_candidate',
    CASE WHEN v_actor_id IS NULL THEN 'system' ELSE 'user' END,
    v_actor_id,
    CASE WHEN v_actor_id IS NULL THEN 'classification-candidate-script' ELSE NULL END
  );

  RETURN jsonb_build_object(
    'contentType', v_content_type,
    'contentId', p_content_id,
    'classification', jsonb_build_object(
      'recommendedMinAge', v_new -> 'recommended_min_age',
      'recommendedMaxAge', v_new -> 'recommended_max_age',
      'supportLevel', v_new -> 'support_level',
      'status', 'unreviewed',
      'source', 'rules_v1',
      'revision', v_new -> 'classification_revision'
    )
  );
END;
$$;

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
  v_author_id uuid;
BEGIN
  IF NOT public.is_moderator_or_admin()
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() IS NOT NULL AND p_reviewer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Reviewer must come from the authenticated session' USING ERRCODE = '42501';
  END IF;
  IF v_reviewer_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS reviewer
    WHERE reviewer.id = v_reviewer_id AND reviewer.role IN ('moderator', 'admin')
  ) THEN
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
      RAISE EXCEPTION 'Self review is not allowed' USING ERRCODE = '42501';
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
    COALESCE(NULLIF(p_note, ''), CASE WHEN v_decision = 'approve' THEN 'manual_review' ELSE 'returned_for_revision' END),
    'user',
    v_reviewer_id,
    p_idempotency_key
  );

  RETURN jsonb_build_object(
    'alreadyProcessed', false,
    'contentType', v_content_type,
    'contentId', p_content_id,
    'decision', v_decision,
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

REVOKE ALL ON FUNCTION public.set_content_classification_candidate(text, bigint, smallint, smallint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_content_classification_candidate(text, bigint, smallint, smallint, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.review_content_classification(text, bigint, bigint, text, smallint, smallint, text, smallint, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_content_classification(text, bigint, bigint, text, smallint, smallint, text, smallint, text, uuid, uuid) TO authenticated, service_role;

-- Keep PostgREST's schema cache aware of the new RPCs.
NOTIFY pgrst, 'reload schema';
