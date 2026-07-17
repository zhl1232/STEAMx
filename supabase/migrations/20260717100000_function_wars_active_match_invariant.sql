-- Prevent a Function Wars participant from occupying multiple active matches.
-- Advisory locks serialize cross-column host/guest checks that cannot be
-- represented by a partial unique index on the match table itself.

CREATE OR REPLACE FUNCTION public.enforce_function_wars_single_active_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  participant_id uuid;
BEGIN
  IF NEW.status NOT IN ('waiting', 'playing') THEN
    RETURN NEW;
  END IF;

  FOR participant_id IN
    SELECT DISTINCT candidate.user_id
    FROM pg_catalog.unnest(ARRAY[NEW.host_user_id, NEW.guest_user_id])
      AS candidate(user_id)
    WHERE candidate.user_id IS NOT NULL
    ORDER BY candidate.user_id
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'function_wars_active_participant:' || participant_id::text,
        0
      )
    );
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.function_wars_matches AS match
    WHERE match.id <> NEW.id
      AND match.status IN ('waiting', 'playing')
      AND (
        match.host_user_id = NEW.host_user_id
        OR match.host_user_id = NEW.guest_user_id
        OR match.guest_user_id = NEW.host_user_id
        OR match.guest_user_id = NEW.guest_user_id
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'function_wars_user_already_active',
      CONSTRAINT = 'function_wars_matches_one_active_participant';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_function_wars_single_active_match()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_function_wars_single_active_match
  ON public.function_wars_matches;
CREATE TRIGGER trg_function_wars_single_active_match
BEFORE INSERT OR UPDATE OF host_user_id, guest_user_id, status
ON public.function_wars_matches
FOR EACH ROW EXECUTE FUNCTION public.enforce_function_wars_single_active_match();

-- Refresh both participants in a deterministic order so concurrent matches
-- involving the same users cannot lock playground_stats rows in reverse order.
CREATE OR REPLACE FUNCTION public.record_function_wars_match_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  participant_id uuid;
BEGIN
  IF NEW.status <> 'finished'
     OR OLD.status = 'finished'
     OR NEW.guest_user_id IS NULL
  THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.function_wars_match_results (match_id, user_id, result)
  VALUES
    (
      NEW.id,
      NEW.host_user_id,
      CASE
        WHEN NEW.winner = 'draw' THEN 'draw'
        WHEN NEW.winner = 'host' THEN 'win'
        ELSE 'loss'
      END
    ),
    (
      NEW.id,
      NEW.guest_user_id,
      CASE
        WHEN NEW.winner = 'draw' THEN 'draw'
        WHEN NEW.winner = 'guest' THEN 'win'
        ELSE 'loss'
      END
    )
  ON CONFLICT (match_id, user_id) DO NOTHING;

  FOR participant_id IN
    SELECT DISTINCT participant.user_id
    FROM (
      VALUES (NEW.host_user_id), (NEW.guest_user_id)
    ) AS participant(user_id)
    WHERE participant.user_id IS NOT NULL
    ORDER BY participant.user_id
  LOOP
    PERFORM public.sync_function_wars_online_stats(participant_id);
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.record_function_wars_match_results()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.enforce_function_wars_single_active_match() IS
  'Serializes Function Wars participants and rejects a second waiting or playing match for either user.';

NOTIFY pgrst, 'reload schema';
