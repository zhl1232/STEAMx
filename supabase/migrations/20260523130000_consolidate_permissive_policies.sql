-- Consolidate multiple permissive RLS policies and drop a duplicate index.
-- Addresses Supabase Performance Advisor warnings:
--   - multiple_permissive_policies (~70 rows)
--   - duplicate_index (idx_comments_project_created vs idx_comments_project_created_at)
--
-- Three structural patterns are applied:
--   A. FOR ALL admin/owner policy + dedicated SELECT policy overlap
--      → split FOR ALL into FOR INSERT / FOR UPDATE / FOR DELETE
--        (no SELECT). The SELECT policy is the sole policy on reads.
--   B. Two FOR SELECT permissive policies for the same target role
--      → merge into a single policy with USING (a OR b).
--   C. Pure name duplicates / strict supersets
--      → drop the redundant one, keep the broader / safer / cleaner one.
--
-- All expressions below are reproduced verbatim from the current
-- pg_policies (already wrapped with (select auth.<fn>()) by the prior
-- migration 20260523120000_wrap_rls_auth_calls.sql).
--
-- ⚠️ SECURITY-RELEVANT BEHAVIOR CHANGES (see comments inline):
--   - `comments` INSERT: removed permissive fallback that allowed any
--     authenticated user to insert with any author_id.
--   - `discussion_replies` INSERT: same fix.

-- ============================================================
-- Duplicate index
-- ============================================================
DROP INDEX IF EXISTS public.idx_comments_project_created;

-- ============================================================
-- C. Pure duplicates / strict supersets
-- ============================================================

-- profiles: "Users can update own profile." (with trailing period) is an
-- exact dupe of "Users can update own profile". Drop the period one.
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

-- comments: two SELECT policies with USING (true)
DROP POLICY IF EXISTS "Anyone can view comments" ON public.comments;
-- keep: "Comments viewable by everyone"

-- comments: drop the looser INSERT policy.
-- ⚠️ Tightens security: the dropped policy was
--   WITH CHECK ((select auth.uid()) IS NOT NULL)
-- which permitted any authenticated user to insert a comment with an
-- arbitrary author_id. The kept policy
--   WITH CHECK ((select auth.role()) = 'authenticated'
--               AND (select auth.uid()) = author_id)
-- binds author_id to the inserter, which is the intended invariant.
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.comments;
-- keep: "Authenticated users can add comments"

-- comments: DELETE has two semantically equivalent policies
--   "Authors and moderators can delete comments" — uses is_moderator_or_admin()
--   "Users can delete own comments or moderators can delete any" — inline EXISTS
-- Drop the inline-EXISTS one; the helper-based one is cleaner.
DROP POLICY IF EXISTS "Users can delete own comments or moderators can delete any" ON public.comments;

-- discussion_replies: SELECT dupes
DROP POLICY IF EXISTS "Anyone can view discussion replies" ON public.discussion_replies;
-- keep: "Discussion replies viewable by everyone"

-- discussion_replies: INSERT — same security-tightening choice as comments
DROP POLICY IF EXISTS "Authenticated users can create discussion replies" ON public.discussion_replies;
-- keep: "Authenticated users can add replies"

-- discussion_replies: DELETE — author-only policy is a strict subset of the
-- "authors AND moderators" policy. Drop the subset.
DROP POLICY IF EXISTS "Users can delete their own discussion replies" ON public.discussion_replies;
-- keep: "Authors and moderators can delete discussion replies"


-- ============================================================
-- B. Merge two SELECT permissive policies into one
-- ============================================================

-- reports: moderator OR own
DROP POLICY IF EXISTS reports_select_mod ON public.reports;
DROP POLICY IF EXISTS reports_select_own ON public.reports;
DROP POLICY IF EXISTS reports_select     ON public.reports;
CREATE POLICY reports_select
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (is_moderator_or_admin() OR (select auth.uid()) = reporter_id);

-- moderator_applications: admin OR own
DROP POLICY IF EXISTS "Admins can view all applications" ON public.moderator_applications;
DROP POLICY IF EXISTS "Users can view own applications"  ON public.moderator_applications;
DROP POLICY IF EXISTS "View own or admin applications"   ON public.moderator_applications;
CREATE POLICY "View own or admin applications"
  ON public.moderator_applications
  FOR SELECT
  USING (is_admin() OR (select auth.uid()) = user_id);

-- observation_events: public_read (anon+auth, approved+is_public) OR own (auth)
-- Merged for role=public: anon users get auth.uid()=NULL so the own branch is
-- NULL (i.e. false); they see only approved+public rows. Authenticated users
-- see either branch. Semantics preserved exactly.
DROP POLICY IF EXISTS observation_events_public_read ON public.observation_events;
DROP POLICY IF EXISTS observation_events_select_own  ON public.observation_events;
DROP POLICY IF EXISTS observation_events_select      ON public.observation_events;
CREATE POLICY observation_events_select
  ON public.observation_events
  FOR SELECT
  USING (
    (is_public = true AND status = 'approved')
    OR (select auth.uid()) = user_id
  );

-- observation_event_species: same pattern via parent observation_events row
DROP POLICY IF EXISTS observation_event_species_public_read ON public.observation_event_species;
DROP POLICY IF EXISTS observation_event_species_select_own  ON public.observation_event_species;
DROP POLICY IF EXISTS observation_event_species_select      ON public.observation_event_species;
CREATE POLICY observation_event_species_select
  ON public.observation_event_species
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.observation_events oe
      WHERE oe.id = observation_event_species.observation_event_id
        AND (
          (oe.is_public = true AND oe.status = 'approved')
          OR oe.user_id = (select auth.uid())
        )
    )
  );


-- ============================================================
-- A. Split FOR ALL policies into INSERT/UPDATE/DELETE only
-- ============================================================
-- Each table below originally had:
--   • a dedicated FOR SELECT policy (public or conditional)
--   • a FOR ALL admin/owner mutation policy that ALSO covered SELECT,
--     causing the multiple-permissive overlap.
-- We drop the FOR ALL and recreate as 3 separate non-SELECT policies
-- with identical USING/WITH CHECK. The dedicated SELECT policy becomes
-- the sole policy for reads.
--
-- Note: when the original FOR ALL had no explicit WITH CHECK, Postgres
-- defaults WITH CHECK for INSERT/UPDATE to the USING expression. We
-- replicate that here by writing the same expression into both clauses.

-- categories: admin manages
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can insert categories" ON public.categories
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));
CREATE POLICY "Admins can update categories" ON public.categories
  FOR UPDATE
  USING      (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));
CREATE POLICY "Admins can delete categories" ON public.categories
  FOR DELETE
  USING      (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));

-- sub_categories: admin manages
DROP POLICY IF EXISTS "Admins can manage sub categories" ON public.sub_categories;
CREATE POLICY "Admins can insert sub categories" ON public.sub_categories
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));
CREATE POLICY "Admins can update sub categories" ON public.sub_categories
  FOR UPDATE
  USING      (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));
CREATE POLICY "Admins can delete sub categories" ON public.sub_categories
  FOR DELETE
  USING      (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::text));

-- tags: moderator manages
DROP POLICY IF EXISTS "Moderators can manage tags" ON public.tags;
CREATE POLICY "Moderators can insert tags" ON public.tags
  FOR INSERT
  WITH CHECK (is_moderator_or_admin());
CREATE POLICY "Moderators can update tags" ON public.tags
  FOR UPDATE
  USING      (is_moderator_or_admin())
  WITH CHECK (is_moderator_or_admin());
CREATE POLICY "Moderators can delete tags" ON public.tags
  FOR DELETE
  USING      (is_moderator_or_admin());

-- challenge_participants: user owns own
DROP POLICY IF EXISTS "Users can manage their own challenge participation" ON public.challenge_participants;
CREATE POLICY "Users can insert their own challenge participation" ON public.challenge_participants
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their own challenge participation" ON public.challenge_participants
  FOR UPDATE
  USING      ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete their own challenge participation" ON public.challenge_participants
  FOR DELETE
  USING      ((select auth.uid()) = user_id);

-- completed_projects: user owns own
DROP POLICY IF EXISTS "Users can manage their own completions" ON public.completed_projects;
CREATE POLICY "Users can insert their own completions" ON public.completed_projects
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their own completions" ON public.completed_projects
  FOR UPDATE
  USING      ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete their own completions" ON public.completed_projects
  FOR DELETE
  USING      ((select auth.uid()) = user_id);

-- likes: user owns own
DROP POLICY IF EXISTS "Users can manage their own likes" ON public.likes;
CREATE POLICY "Users can insert their own likes" ON public.likes
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their own likes" ON public.likes
  FOR UPDATE
  USING      ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete their own likes" ON public.likes
  FOR DELETE
  USING      ((select auth.uid()) = user_id);

-- project_explorations: user owns own (had explicit WITH CHECK)
DROP POLICY IF EXISTS "Users manage own explorations" ON public.project_explorations;
CREATE POLICY "Users insert own explorations" ON public.project_explorations
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users update own explorations" ON public.project_explorations
  FOR UPDATE
  USING      ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users delete own explorations" ON public.project_explorations
  FOR DELETE
  USING      ((select auth.uid()) = user_id);

-- project_materials: project author manages
DROP POLICY IF EXISTS "Authors can manage their project materials" ON public.project_materials;
CREATE POLICY "Authors can insert project materials" ON public.project_materials
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_materials.project_id AND projects.author_id = (select auth.uid())));
CREATE POLICY "Authors can update project materials" ON public.project_materials
  FOR UPDATE
  USING      (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_materials.project_id AND projects.author_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_materials.project_id AND projects.author_id = (select auth.uid())));
CREATE POLICY "Authors can delete project materials" ON public.project_materials
  FOR DELETE
  USING      (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_materials.project_id AND projects.author_id = (select auth.uid())));

-- project_steps: project author manages
DROP POLICY IF EXISTS "Authors can manage their project steps" ON public.project_steps;
CREATE POLICY "Authors can insert project steps" ON public.project_steps
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_steps.project_id AND projects.author_id = (select auth.uid())));
CREATE POLICY "Authors can update project steps" ON public.project_steps
  FOR UPDATE
  USING      (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_steps.project_id AND projects.author_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_steps.project_id AND projects.author_id = (select auth.uid())));
CREATE POLICY "Authors can delete project steps" ON public.project_steps
  FOR DELETE
  USING      (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_steps.project_id AND projects.author_id = (select auth.uid())));

-- project_tags: project author manages
DROP POLICY IF EXISTS "Project authors can manage their project tags" ON public.project_tags;
CREATE POLICY "Project authors can insert project tags" ON public.project_tags
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_tags.project_id AND projects.author_id = (select auth.uid())));
CREATE POLICY "Project authors can update project tags" ON public.project_tags
  FOR UPDATE
  USING      (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_tags.project_id AND projects.author_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_tags.project_id AND projects.author_id = (select auth.uid())));
CREATE POLICY "Project authors can delete project tags" ON public.project_tags
  FOR DELETE
  USING      (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_tags.project_id AND projects.author_id = (select auth.uid())));

-- challenge_submission_projects: submission owner or moderator
DROP POLICY IF EXISTS challenge_submission_projects_mutate ON public.challenge_submission_projects;
CREATE POLICY challenge_submission_projects_insert ON public.challenge_submission_projects
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.challenge_submissions cs
      WHERE cs.id = challenge_submission_projects.submission_id
        AND (
          cs.user_id = (select auth.uid())
          OR EXISTS (SELECT 1 FROM public.profiles
                     WHERE profiles.id = (select auth.uid())
                       AND profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text]))
        )
    )
  );
CREATE POLICY challenge_submission_projects_update ON public.challenge_submission_projects
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.challenge_submissions cs
      WHERE cs.id = challenge_submission_projects.submission_id
        AND (
          cs.user_id = (select auth.uid())
          OR EXISTS (SELECT 1 FROM public.profiles
                     WHERE profiles.id = (select auth.uid())
                       AND profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text]))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.challenge_submissions cs
      WHERE cs.id = challenge_submission_projects.submission_id
        AND (
          cs.user_id = (select auth.uid())
          OR EXISTS (SELECT 1 FROM public.profiles
                     WHERE profiles.id = (select auth.uid())
                       AND profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text]))
        )
    )
  );
CREATE POLICY challenge_submission_projects_delete ON public.challenge_submission_projects
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.challenge_submissions cs
      WHERE cs.id = challenge_submission_projects.submission_id
        AND (
          cs.user_id = (select auth.uid())
          OR EXISTS (SELECT 1 FROM public.profiles
                     WHERE profiles.id = (select auth.uid())
                       AND profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text]))
        )
    )
  );

-- completion_moderation_logs: service_role manages (was FOR ALL, drop SELECT)
-- service_role bypasses RLS anyway, so this is mostly documentation. Keep
-- the policy split to make intent clear and to satisfy the linter.
DROP POLICY IF EXISTS "Service role manages moderation logs" ON public.completion_moderation_logs;
CREATE POLICY "Service role inserts moderation logs" ON public.completion_moderation_logs
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role'::text);
CREATE POLICY "Service role updates moderation logs" ON public.completion_moderation_logs
  FOR UPDATE
  USING      ((select auth.role()) = 'service_role'::text)
  WITH CHECK ((select auth.role()) = 'service_role'::text);
CREATE POLICY "Service role deletes moderation logs" ON public.completion_moderation_logs
  FOR DELETE
  USING      ((select auth.role()) = 'service_role'::text);
