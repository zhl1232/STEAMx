-- Community safety governance: blocks, moderation cases, safety actions and appeals.
-- This migration is additive and keeps the legacy interaction_restricted flag as a
-- compatibility projection for existing clients.

--------------------------------------------------------------------------------
-- 1. Account safety metadata
--------------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS safety_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS safety_restricted_until timestamptz,
  ADD COLUMN IF NOT EXISTS safety_restriction_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_safety_status_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_safety_status_check
      CHECK (safety_status IN ('active', 'suspended', 'banned'));
  END IF;
END $$;

--------------------------------------------------------------------------------
-- 2. User blocks
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_user_id),
  CONSTRAINT user_blocks_no_self CHECK (blocker_id <> blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_user
  ON public.user_blocks (blocked_user_id, created_at DESC);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_blocks_select_own ON public.user_blocks;
CREATE POLICY user_blocks_select_own
  ON public.user_blocks FOR SELECT TO authenticated
  USING ((select auth.uid()) = blocker_id OR (select auth.uid()) = blocked_user_id);

DROP POLICY IF EXISTS user_blocks_insert_own ON public.user_blocks;
CREATE POLICY user_blocks_insert_own
  ON public.user_blocks FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = blocker_id);

DROP POLICY IF EXISTS user_blocks_delete_own ON public.user_blocks;
CREATE POLICY user_blocks_delete_own
  ON public.user_blocks FOR DELETE TO authenticated
  USING ((select auth.uid()) = blocker_id);

GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;

CREATE OR REPLACE FUNCTION public.are_users_blocked(
  p_first_user_id uuid,
  p_second_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_blocks b
    WHERE (b.blocker_id = p_first_user_id AND b.blocked_user_id = p_second_user_id)
       OR (b.blocker_id = p_second_user_id AND b.blocked_user_id = p_first_user_id)
  )
$$;

REVOKE ALL ON FUNCTION public.are_users_blocked(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.are_users_blocked(uuid, uuid) TO service_role;

--------------------------------------------------------------------------------
-- 3. Moderation cases and account actions
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.moderation_cases (
  id bigserial PRIMARY KEY,
  content_type text NOT NULL,
  content_id bigint NOT NULL,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'automatic'
    CHECK (source IN ('automatic', 'report', 'admin', 'appeal')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'hidden')),
  risk_level text NOT NULL DEFAULT 'medium'
    CHECK (risk_level IN ('low', 'medium', 'high')),
  category text,
  reason text,
  model_name text,
  snapshot_text text,
  snapshot_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moderation_cases_queue
  ON public.moderation_cases (status, risk_level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_content
  ON public.moderation_cases (content_type, content_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_author
  ON public.moderation_cases (author_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_moderation_cases_one_active
  ON public.moderation_cases (content_type, content_id)
  WHERE status IN ('pending', 'hidden');

ALTER TABLE public.moderation_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS moderation_cases_select_staff ON public.moderation_cases;
CREATE POLICY moderation_cases_select_staff
  ON public.moderation_cases FOR SELECT TO authenticated
  USING (is_moderator_or_admin());

DROP POLICY IF EXISTS moderation_cases_insert_staff ON public.moderation_cases;
CREATE POLICY moderation_cases_insert_staff
  ON public.moderation_cases FOR INSERT TO authenticated
  WITH CHECK (is_moderator_or_admin());

DROP POLICY IF EXISTS moderation_cases_update_staff ON public.moderation_cases;
CREATE POLICY moderation_cases_update_staff
  ON public.moderation_cases FOR UPDATE TO authenticated
  USING (is_moderator_or_admin())
  WITH CHECK (is_moderator_or_admin());

GRANT SELECT, INSERT, UPDATE ON public.moderation_cases TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.moderation_cases_id_seq TO authenticated;

CREATE TABLE IF NOT EXISTS public.safety_actions (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type text NOT NULL
    CHECK (action_type IN ('warning', 'interaction_restriction', 'account_suspension', 'account_ban')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'revoked')),
  reason text NOT NULL,
  source_report_id bigint REFERENCES public.reports(id) ON DELETE SET NULL,
  source_case_id bigint REFERENCES public.moderation_cases(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT safety_actions_valid_window CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_safety_actions_user_active
  ON public.safety_actions (user_id, status, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_safety_actions_source_report
  ON public.safety_actions (source_report_id)
  WHERE source_report_id IS NOT NULL;

ALTER TABLE public.safety_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS safety_actions_select_own_or_staff ON public.safety_actions;
CREATE POLICY safety_actions_select_own_or_staff
  ON public.safety_actions FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id OR is_moderator_or_admin());

DROP POLICY IF EXISTS safety_actions_insert_staff ON public.safety_actions;
CREATE POLICY safety_actions_insert_staff
  ON public.safety_actions FOR INSERT TO authenticated
  WITH CHECK (is_moderator_or_admin());

DROP POLICY IF EXISTS safety_actions_update_staff ON public.safety_actions;
CREATE POLICY safety_actions_update_staff
  ON public.safety_actions FOR UPDATE TO authenticated
  USING (is_moderator_or_admin())
  WITH CHECK (is_moderator_or_admin());

GRANT SELECT, INSERT, UPDATE ON public.safety_actions TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.safety_actions_id_seq TO authenticated;

--------------------------------------------------------------------------------
-- 4. Reports and appeals
--------------------------------------------------------------------------------

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS snapshot_text text,
  ADD COLUMN IF NOT EXISTS snapshot_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS moderation_case_id bigint REFERENCES public.moderation_cases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_action text,
  ADD COLUMN IF NOT EXISTS evidence_expires_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reports_risk_level_check'
      AND conrelid = 'public.reports'::regclass
  ) THEN
    ALTER TABLE public.reports
      ADD CONSTRAINT reports_risk_level_check
      CHECK (risk_level IN ('low', 'medium', 'high'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reports_risk_queue
  ON public.reports (status, risk_level, created_at DESC);

CREATE TABLE IF NOT EXISTS public.safety_appeals (
  id bigserial PRIMARY KEY,
  action_id bigint NOT NULL REFERENCES public.safety_actions(id) ON DELETE CASCADE,
  appellant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_safety_appeals_one_pending
  ON public.safety_appeals (action_id, appellant_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_safety_appeals_queue
  ON public.safety_appeals (status, created_at DESC);

ALTER TABLE public.safety_appeals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS safety_appeals_select_own_or_staff ON public.safety_appeals;
CREATE POLICY safety_appeals_select_own_or_staff
  ON public.safety_appeals FOR SELECT TO authenticated
  USING ((select auth.uid()) = appellant_id OR is_moderator_or_admin());

DROP POLICY IF EXISTS safety_appeals_insert_own ON public.safety_appeals;
CREATE POLICY safety_appeals_insert_own
  ON public.safety_appeals FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = appellant_id);

DROP POLICY IF EXISTS safety_appeals_update_staff ON public.safety_appeals;
CREATE POLICY safety_appeals_update_staff
  ON public.safety_appeals FOR UPDATE TO authenticated
  USING (is_moderator_or_admin())
  WITH CHECK (is_moderator_or_admin());

GRANT SELECT, INSERT, UPDATE ON public.safety_appeals TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.safety_appeals_id_seq TO authenticated;

--------------------------------------------------------------------------------
-- 5. Moderation state on user-generated records
--------------------------------------------------------------------------------

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'projects',
    'comments',
    'discussions',
    'discussion_replies',
    'completion_comments',
    'observation_comments',
    'completed_projects',
    'observation_events',
    'challenge_submissions',
    'messages'
  ] LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS moderation_state text NOT NULL DEFAULT ''approved''',
        table_name
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (moderation_state)',
        'idx_' || table_name || '_moderation_state', table_name
      );
    END IF;
  END LOOP;
END $$;

--------------------------------------------------------------------------------
-- 5b. Public reads must never expose pending/hidden safety content
--------------------------------------------------------------------------------

-- Existing public policies predate moderation_state and some use USING (true).
-- Replace only SELECT policies so owners and staff retain the review workflow
-- while ordinary readers see approved content only.

DROP POLICY IF EXISTS "Projects visibility policy" ON public.projects;
CREATE POLICY "Projects visibility policy"
  ON public.projects FOR SELECT
  USING (
    (
      status = 'approved'
      AND moderation_state = 'approved'
    )
    OR (select auth.uid()) = author_id
    OR is_moderator_or_admin()
  );

DROP POLICY IF EXISTS "Comments viewable by everyone" ON public.comments;
CREATE POLICY "Comments viewable by everyone"
  ON public.comments FOR SELECT
  USING (
    (
      moderation_state = 'approved'
      AND EXISTS (
        SELECT 1
        FROM public.projects p
        WHERE p.id = comments.project_id
          AND p.status = 'approved'
          AND p.moderation_state = 'approved'
      )
    )
    OR (select auth.uid()) = author_id
    OR is_moderator_or_admin()
  );

DROP POLICY IF EXISTS "Discussions viewable by everyone" ON public.discussions;
CREATE POLICY "Discussions viewable by everyone"
  ON public.discussions FOR SELECT
  USING (
    moderation_state = 'approved'
    OR (select auth.uid()) = author_id
    OR is_moderator_or_admin()
  );

DROP POLICY IF EXISTS "Discussion replies viewable by everyone" ON public.discussion_replies;
CREATE POLICY "Discussion replies viewable by everyone"
  ON public.discussion_replies FOR SELECT
  USING (
    (
      moderation_state = 'approved'
      AND EXISTS (
        SELECT 1
        FROM public.discussions d
        WHERE d.id = discussion_replies.discussion_id
          AND d.moderation_state = 'approved'
      )
    )
    OR (select auth.uid()) = author_id
    OR is_moderator_or_admin()
  );

DROP POLICY IF EXISTS "Anyone can view completion comments" ON public.completion_comments;
CREATE POLICY "Anyone can view completion comments"
  ON public.completion_comments FOR SELECT
  USING (
    (
      moderation_state = 'approved'
      AND EXISTS (
        SELECT 1
        FROM public.completed_projects cp
        WHERE cp.id = completion_comments.completed_project_id
          AND cp.status = 'approved'
          AND cp.is_public = true
          AND cp.moderation_state = 'approved'
      )
    )
    OR (select auth.uid()) = author_id
    OR is_moderator_or_admin()
  );

DROP POLICY IF EXISTS "Observation comments are viewable by everyone" ON public.observation_comments;
CREATE POLICY "Observation comments are viewable by everyone"
  ON public.observation_comments FOR SELECT
  USING (
    (
      moderation_state = 'approved'
      AND EXISTS (
        SELECT 1
        FROM public.observation_events oe
        WHERE oe.id = observation_comments.observation_event_id
          AND oe.is_public = true
          AND oe.status = 'approved'
          AND oe.moderation_state = 'approved'
      )
    )
    OR (select auth.uid()) = author_id
    OR is_moderator_or_admin()
  );

DROP POLICY IF EXISTS "Completed projects visibility with review" ON public.completed_projects;
CREATE POLICY "Completed projects visibility with review"
  ON public.completed_projects FOR SELECT
  USING (
    (
      status = 'approved'
      AND is_public = true
      AND moderation_state = 'approved'
    )
    OR (select auth.uid()) = user_id
    OR is_moderator_or_admin()
  );

DROP POLICY IF EXISTS observation_events_select ON public.observation_events;
CREATE POLICY observation_events_select
  ON public.observation_events FOR SELECT
  USING (
    (
      is_public = true
      AND status = 'approved'
      AND moderation_state = 'approved'
    )
    OR (select auth.uid()) = user_id
    OR is_moderator_or_admin()
  );

DROP POLICY IF EXISTS observation_event_species_public_read ON public.observation_event_species;
DROP POLICY IF EXISTS observation_event_species_select_own ON public.observation_event_species;
DROP POLICY IF EXISTS observation_event_species_select ON public.observation_event_species;
CREATE POLICY observation_event_species_select
  ON public.observation_event_species FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.observation_events oe
      WHERE oe.id = observation_event_species.observation_event_id
        AND (
          (
            oe.is_public = true
            AND oe.status = 'approved'
            AND oe.moderation_state = 'approved'
          )
          OR oe.user_id = (select auth.uid())
          OR is_moderator_or_admin()
        )
    )
  );

DROP POLICY IF EXISTS "challenge_submissions_select" ON public.challenge_submissions;
CREATE POLICY "challenge_submissions_select"
  ON public.challenge_submissions FOR SELECT
  USING (
    (
      status = 'approved'
      AND is_public = true
      AND moderation_state = 'approved'
    )
    OR (select auth.uid()) = user_id
    OR is_moderator_or_admin()
  );

-- Discussions were historically insertable with any authenticated author_id.
-- Bind the author to the current user while the content API performs review.
DROP POLICY IF EXISTS "Authenticated users can create discussions" ON public.discussions;
CREATE POLICY "Authenticated users can create discussions"
  ON public.discussions FOR INSERT
  WITH CHECK ((select auth.uid()) = author_id);

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (
    (select auth.uid()) = user_id
    AND (
      from_user_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM public.user_blocks b
        WHERE (b.blocker_id = (select auth.uid()) AND b.blocked_user_id = from_user_id)
           OR (b.blocker_id = from_user_id AND b.blocked_user_id = (select auth.uid()))
      )
    )
  );

--------------------------------------------------------------------------------
-- 5c. Evidence retention helper
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.purge_expired_report_evidence()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  purged_count integer;
BEGIN
  UPDATE public.reports
  SET snapshot_text = NULL,
      snapshot_metadata = '{}'::jsonb
  WHERE evidence_expires_at IS NOT NULL
    AND evidence_expires_at <= now()
    AND (snapshot_text IS NOT NULL OR snapshot_metadata <> '{}'::jsonb);

  GET DIAGNOSTICS purged_count = ROW_COUNT;
  RETURN purged_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_report_evidence() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_report_evidence() TO service_role;

--------------------------------------------------------------------------------
-- 6. Security helpers and message RLS
--------------------------------------------------------------------------------

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
        p_capability IN ('engage', 'save_progress')
        OR p.age_confirmed_at IS NOT NULL
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_can_interact(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_interact(text) TO service_role;

DROP POLICY IF EXISTS "Users can read own messages" ON public.messages;
CREATE POLICY "Users can read own messages"
  ON public.messages FOR SELECT
  USING (
    ((select auth.uid()) = sender_id OR (select auth.uid()) = receiver_id)
    AND (moderation_state = 'approved' OR (select auth.uid()) = sender_id OR is_moderator_or_admin())
  );

DROP POLICY IF EXISTS "Users can send messages as sender" ON public.messages;
CREATE POLICY "Users can send messages as sender"
  ON public.messages FOR INSERT
  WITH CHECK ((select auth.uid()) = sender_id AND moderation_state IN ('pending', 'approved'));

COMMENT ON TABLE public.user_blocks IS '双向断开社区互动的用户屏蔽关系';
COMMENT ON TABLE public.moderation_cases IS '自动审核、举报和人工审核案件';
COMMENT ON TABLE public.safety_actions IS '账号警告、互动限制和封禁审计记录';
COMMENT ON TABLE public.safety_appeals IS '用户对安全处罚提交的申诉';
