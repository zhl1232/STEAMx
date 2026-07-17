-- Make Function Wars fire transitions server-authoritative and terminate abandoned matches.

ALTER TABLE public.function_wars_matches
  ADD COLUMN IF NOT EXISTS host_consecutive_timeouts integer NOT NULL DEFAULT 0
    CHECK (host_consecutive_timeouts BETWEEN 0 AND 2),
  ADD COLUMN IF NOT EXISTS guest_consecutive_timeouts integer NOT NULL DEFAULT 0
    CHECK (guest_consecutive_timeouts BETWEEN 0 AND 2);

CREATE TABLE IF NOT EXISTS public.function_wars_match_results (
  match_id    uuid NOT NULL REFERENCES public.function_wars_matches(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  result      text NOT NULL CHECK (result IN ('win', 'loss', 'draw')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_function_wars_match_results_user
  ON public.function_wars_match_results(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_function_wars_match_results_user_wins
  ON public.function_wars_match_results(user_id)
  WHERE result = 'win';

ALTER TABLE public.function_wars_match_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "function_wars_match_results_select" ON public.function_wars_match_results;
CREATE POLICY "function_wars_match_results_select"
ON public.function_wars_match_results FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.function_wars_match_results FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.function_wars_match_results TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_function_wars_online_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  game_stats jsonb;
  online_games integer;
  online_wins integer;
BEGIN
  SELECT count(*)::integer,
         count(*) FILTER (WHERE result = 'win')::integer
  INTO online_games, online_wins
  FROM public.function_wars_match_results
  WHERE user_id = NEW.user_id;

  IF jsonb_typeof(NEW.stats) <> 'object' THEN
    NEW.stats := '{}'::jsonb;
  END IF;
  game_stats := CASE
    WHEN jsonb_typeof(NEW.stats -> 'function_wars_stats') = 'object'
      THEN NEW.stats -> 'function_wars_stats'
    ELSE '{}'::jsonb
  END;
  game_stats := jsonb_set(game_stats, '{onlineGames}', to_jsonb(online_games), true);
  game_stats := jsonb_set(game_stats, '{onlineWins}', to_jsonb(online_wins), true);
  NEW.stats := jsonb_set(NEW.stats, '{function_wars_stats}', game_stats, true);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_function_wars_online_stats() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_function_wars_online_stats ON public.playground_stats;
CREATE TRIGGER trg_enforce_function_wars_online_stats
BEFORE INSERT OR UPDATE OF stats ON public.playground_stats
FOR EACH ROW EXECUTE FUNCTION public.enforce_function_wars_online_stats();

CREATE OR REPLACE FUNCTION public.sync_function_wars_online_stats(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.playground_stats (user_id, stats, updated_at)
  VALUES (p_user_id, '{}'::jsonb, now())
  ON CONFLICT (user_id) DO UPDATE
  SET stats = public.playground_stats.stats,
      updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.sync_function_wars_online_stats(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_function_wars_match_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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

  PERFORM public.sync_function_wars_online_stats(NEW.host_user_id);
  PERFORM public.sync_function_wars_online_stats(NEW.guest_user_id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.record_function_wars_match_results() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_record_function_wars_match_results
  ON public.function_wars_matches;
CREATE TRIGGER trg_record_function_wars_match_results
AFTER UPDATE OF status, winner ON public.function_wars_matches
FOR EACH ROW EXECUTE FUNCTION public.record_function_wars_match_results();

INSERT INTO public.function_wars_match_results (match_id, user_id, result)
SELECT match.id,
       participant.user_id,
       CASE
         WHEN match.winner = 'draw' THEN 'draw'
         WHEN match.winner = participant.role THEN 'win'
         ELSE 'loss'
       END
FROM public.function_wars_matches AS match
CROSS JOIN LATERAL (
  VALUES
    (match.host_user_id, 'host'::text),
    (match.guest_user_id, 'guest'::text)
) AS participant(user_id, role)
WHERE match.status = 'finished'
  AND participant.user_id IS NOT NULL
ON CONFLICT (match_id, user_id) DO NOTHING;

DO $$
DECLARE
  participant_id uuid;
BEGIN
  FOR participant_id IN
    SELECT DISTINCT user_id FROM public.function_wars_match_results
  LOOP
    PERFORM public.sync_function_wars_online_stats(participant_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.function_wars_advance_expired_turn(match_uuid uuid)
RETURNS TABLE(advanced boolean, current_turn text, turn_deadline_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  m public.function_wars_matches%ROWTYPE;
  did_advance boolean := false;
  next_role text;
  timeout_count integer;
  next_seq integer;
  terminal_winner text;
BEGIN
  SELECT * INTO m
  FROM public.function_wars_matches
  WHERE id = match_uuid
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  WHILE m.status = 'playing'
        AND m.turn_deadline_at IS NOT NULL
        AND m.turn_deadline_at <= now()
  LOOP
    did_advance := true;
    next_role := CASE WHEN m.current_turn = 'host' THEN 'guest' ELSE 'host' END;
    timeout_count := CASE
      WHEN m.current_turn = 'host' THEN m.host_consecutive_timeouts + 1
      ELSE m.guest_consecutive_timeouts + 1
    END;
    next_seq := least(m.shot_seq + 1, 200);
    terminal_winner := CASE
      WHEN timeout_count >= 2 THEN next_role
      WHEN next_seq >= 200 THEN 'draw'
      ELSE NULL
    END;

    UPDATE public.function_wars_matches AS match
    SET current_turn = next_role,
        shot_seq = next_seq,
        last_shot = NULL,
        host_consecutive_timeouts = CASE
          WHEN m.current_turn = 'host' THEN least(timeout_count, 2)
          ELSE m.host_consecutive_timeouts
        END,
        guest_consecutive_timeouts = CASE
          WHEN m.current_turn = 'guest' THEN least(timeout_count, 2)
          ELSE m.guest_consecutive_timeouts
        END,
        status = CASE WHEN terminal_winner IS NULL THEN 'playing' ELSE 'finished' END,
        winner = terminal_winner,
        finished_at = CASE WHEN terminal_winner IS NULL THEN NULL ELSE now() END,
        turn_deadline_at = CASE
          WHEN terminal_winner IS NULL THEN m.turn_deadline_at + interval '60 seconds'
          ELSE NULL
        END
    WHERE match.id = match_uuid
    RETURNING match.* INTO m;
  END LOOP;

  RETURN QUERY SELECT did_advance, m.current_turn, m.turn_deadline_at;
END;
$$;

REVOKE ALL ON FUNCTION public.function_wars_advance_expired_turn(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.function_wars_advance_expired_turn(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.function_wars_fire(uuid, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.function_wars_fire(uuid, text, text, jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.function_wars_fire_authoritative(
  match_uuid uuid,
  p_weapon text,
  p_expression text,
  p_summary jsonb,
  p_expected_shot_seq integer,
  p_actor_user_id uuid
)
RETURNS TABLE(
  ok boolean,
  reason text,
  shot_seq integer,
  current_turn text,
  winner text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  m public.function_wars_matches%ROWTYPE;
  fire_result record;
  previous_sub text := current_setting('request.jwt.claim.sub', true);
  actor_role text;
BEGIN
  PERFORM 1
  FROM public.function_wars_advance_expired_turn(match_uuid);

  SELECT * INTO m
  FROM public.function_wars_matches
  WHERE id = match_uuid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'match_not_found'::text, NULL::integer, NULL::text, NULL::text;
    RETURN;
  END IF;
  IF m.status <> 'playing' THEN
    RETURN QUERY SELECT false, 'match_not_playing'::text, m.shot_seq, m.current_turn, m.winner;
    RETURN;
  END IF;
  IF p_expected_shot_seq IS NULL OR p_expected_shot_seq <> m.shot_seq THEN
    RETURN QUERY SELECT false, 'stale_shot_seq'::text, m.shot_seq, m.current_turn, m.winner;
    RETURN;
  END IF;

  actor_role := CASE
    WHEN p_actor_user_id = m.host_user_id THEN 'host'
    WHEN p_actor_user_id = m.guest_user_id THEN 'guest'
    ELSE NULL
  END;
  IF actor_role IS NULL THEN
    RETURN QUERY SELECT false, 'not_participant'::text, m.shot_seq, m.current_turn, m.winner;
    RETURN;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', p_actor_user_id::text, true);
  SELECT * INTO fire_result
  FROM public.function_wars_fire(match_uuid, p_weapon, p_expression, p_summary);
  PERFORM set_config('request.jwt.claim.sub', COALESCE(previous_sub, ''), true);

  IF fire_result.ok THEN
    UPDATE public.function_wars_matches AS match
    SET host_consecutive_timeouts = CASE
          WHEN actor_role = 'host' THEN 0 ELSE match.host_consecutive_timeouts
        END,
        guest_consecutive_timeouts = CASE
          WHEN actor_role = 'guest' THEN 0 ELSE match.guest_consecutive_timeouts
        END
    WHERE match.id = match_uuid;
  END IF;

  RETURN QUERY SELECT fire_result.ok,
                      fire_result.reason,
                      fire_result.shot_seq,
                      fire_result.current_turn,
                      fire_result.winner;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(previous_sub, ''), true);
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.function_wars_fire_authoritative(uuid, text, text, jsonb, integer, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.function_wars_fire_authoritative(uuid, text, text, jsonb, integer, uuid)
  TO service_role;

COMMENT ON FUNCTION public.function_wars_fire(uuid, text, text, jsonb) IS
  'Internal bounded Function Wars transition. Direct browser execution is revoked; callers must use the authenticated API.';
COMMENT ON FUNCTION public.function_wars_fire_authoritative(uuid, text, text, jsonb, integer, uuid) IS
  'Service-role-only Function Wars transition with participant identity and optimistic shot sequence validation.';
COMMENT ON FUNCTION public.function_wars_advance_expired_turn(uuid) IS
  'Catches up expired turns and forfeits a player after two consecutive missed turns.';
COMMENT ON TABLE public.function_wars_match_results IS
  'Immutable per-match Function Wars results used to derive trusted online game and win totals.';

NOTIFY pgrst, 'reload schema';
