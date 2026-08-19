-- Keep Journey state authoritative even when a client reaches Supabase
-- directly. Public records remain public, but Journey metadata is owner-only.

BEGIN;

-- The first Journey migration used pending final works to infer completion.
-- Pending/private/rejected final works must remain editable attempts.
UPDATE public.project_journeys j
SET
  status = 'active',
  completed_at = NULL,
  updated_at = now()
WHERE j.status = 'completed'
  AND NOT EXISTS (
    SELECT 1
    FROM public.project_journey_records r
    WHERE r.journey_id = j.id
      AND r.record_kind = 'final'
      AND r.visibility = 'public'
      AND r.status = 'approved'
      AND r.moderation_state = 'approved'
  );

DROP POLICY IF EXISTS "project_journeys_owner_or_public" ON public.project_journeys;
CREATE POLICY "project_journeys_owner_or_staff"
  ON public.project_journeys FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

CREATE OR REPLACE FUNCTION public.enforce_project_journey_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NEW.status <> OLD.status THEN
    IF NOT (OLD.status = 'active' AND NEW.status = 'abandoned')
       AND NOT (
         OLD.status = 'completed'
         AND NEW.status = 'active'
         AND NOT EXISTS (
           SELECT 1
           FROM public.project_journey_records r
           WHERE r.journey_id = NEW.id
             AND r.record_kind = 'final'
             AND r.visibility = 'public'
             AND r.status = 'approved'
             AND r.moderation_state = 'approved'
         )
       ) THEN
      RAISE EXCEPTION 'Only moderation can complete or otherwise change a Journey state';
    END IF;
  END IF;

  IF OLD.status = 'completed' AND NEW.status NOT IN ('completed', 'active') THEN
    RAISE EXCEPTION 'Completed Journeys cannot be abandoned';
  END IF;

  IF OLD.status = 'abandoned' AND NEW.status <> 'abandoned' THEN
    RAISE EXCEPTION 'Abandoned Journeys cannot be reopened';
  END IF;

  IF OLD.status = 'completed' AND NEW.status = 'active'
     AND EXISTS (
       SELECT 1
       FROM public.project_journey_records r
       WHERE r.journey_id = NEW.id
         AND r.record_kind = 'final'
         AND r.visibility = 'public'
         AND r.status = 'approved'
         AND r.moderation_state = 'approved'
     ) THEN
    RAISE EXCEPTION 'An approved final record must be revoked before reopening';
  END IF;

  IF NEW.status = 'completed' THEN
    IF NEW.completed_at IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.project_journey_records r
      WHERE r.journey_id = NEW.id
        AND r.record_kind = 'final'
        AND r.visibility = 'public'
        AND r.status = 'approved'
        AND r.moderation_state = 'approved'
    ) THEN
      RAISE EXCEPTION 'A Journey can be completed only after an approved public final record';
    END IF;
  ELSE
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_project_journey_transition ON public.project_journeys;
CREATE TRIGGER trg_enforce_project_journey_transition
  BEFORE UPDATE ON public.project_journeys
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_project_journey_transition();

CREATE OR REPLACE FUNCTION public.enforce_project_journey_record_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Browser writes may create/edit content, but never approve or publish it.
  -- Worker/admin decisions use the service role and intentionally bypass this
  -- normalization through reviewJourneyRecordModeration().
  IF auth.role() <> 'service_role' THEN
    IF TG_OP = 'UPDATE' AND (
      NEW.journey_id <> OLD.journey_id
      OR NEW.user_id <> OLD.user_id
      OR NEW.record_kind <> OLD.record_kind
      OR NEW.anchor_type <> OLD.anchor_type
      OR NEW.anchor_index IS DISTINCT FROM OLD.anchor_index
    ) THEN
      RAISE EXCEPTION 'Journey record identity cannot be changed';
    END IF;

    IF NEW.visibility = 'private' THEN
      NEW.status := 'draft';
      NEW.moderation_state := 'approved';
      NEW.moderation_source := 'private_draft';
    ELSE
      NEW.status := 'pending';
      IF NEW.moderation_state NOT IN ('pending', 'approved') THEN
        NEW.moderation_state := 'pending';
      END IF;
    END IF;
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.published_at := NULL;
    NEW.rejection_reason := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_project_journey_record_write ON public.project_journey_records;
CREATE TRIGGER trg_enforce_project_journey_record_write
  BEFORE INSERT OR UPDATE ON public.project_journey_records
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_project_journey_record_write();

REVOKE ALL ON FUNCTION public.enforce_project_journey_transition() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_project_journey_record_write() FROM PUBLIC;

-- The original challenge submission migration omitted a user DELETE policy.
-- Journey deletion revokes the compatibility projection in-place, but adding
-- the policy keeps future exact cleanup operations scoped to its owner.
DROP POLICY IF EXISTS "challenge_submissions_delete" ON public.challenge_submissions;
CREATE POLICY "challenge_submissions_delete"
  ON public.challenge_submissions FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

COMMIT;
