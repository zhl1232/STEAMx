-- Normalize challenge-facing wording in seeded data and existing records.

UPDATE public.badges
SET name = CASE id
    WHEN 'challenge_bronze' THEN '挑战 · 铜'
    WHEN 'challenge_silver' THEN '挑战 · 银'
    WHEN 'challenge_gold' THEN '挑战 · 金'
    WHEN 'challenge_platinum' THEN '挑战 · 白金'
    ELSE name
  END,
  description = CASE id
    WHEN 'challenge_rookie' THEN '首次参加挑战'
    WHEN 'challenge_bronze' THEN '参加挑战 2 次'
    WHEN 'challenge_silver' THEN '参加挑战 6 次'
    WHEN 'challenge_gold' THEN '参加挑战 15 次'
    WHEN 'challenge_platinum' THEN '参加挑战 30 次'
    WHEN 'challenger' THEN '参加 3 次挑战'
    WHEN 'challenge_enthusiast' THEN '参加 5 次挑战'
    WHEN 'challenge_veteran' THEN '参加 10 次挑战'
    WHEN 'challenge_master' THEN '参加 20 次挑战'
    WHEN 'challenge_champion' THEN '参加 50 次挑战'
    WHEN 'challenge_legend' THEN '参加 100 次挑战'
    ELSE description
  END
WHERE id IN (
  'challenge_rookie',
  'challenge_bronze',
  'challenge_silver',
  'challenge_gold',
  'challenge_platinum',
  'challenger',
  'challenge_enthusiast',
  'challenge_veteran',
  'challenge_master',
  'challenge_champion',
  'challenge_legend'
);

UPDATE public.coin_logs
SET counterparty_display_text = regexp_replace(
  counterparty_display_text,
  '挑战赛第([0-9]+)名奖励',
  '挑战第\1名奖励'
)
WHERE action_type = 'challenge_prize'
  AND counterparty_display_text ~ '挑战赛第[0-9]+名奖励';

CREATE OR REPLACE FUNCTION public.settle_timed_challenge(p_challenge_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_challenge record;
  v_ranked record;
  v_results jsonb := '[]'::jsonb;
  v_rank int := 0;
  v_coins int;
  v_badge_prefix text := 'challenge_winner_';
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  ) THEN
    RAISE EXCEPTION 'Only admins can settle timed challenges';
  END IF;

  SELECT * INTO v_challenge FROM public.challenges
  WHERE id = p_challenge_id AND challenge_type = 'timed' AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge not found or not eligible for settlement';
  END IF;

  FOR v_ranked IN
    SELECT
      p.id AS project_id,
      p.author_id,
      COALESCE(AVG((cr.creativity + cr.practicality + cr.technical + cr.reflection_depth)::numeric / 4.0), 0) AS avg_score,
      COUNT(cr.id) AS rating_count
    FROM public.projects p
    LEFT JOIN public.challenge_ratings cr ON cr.project_id = p.id
    WHERE p.challenge_id = p_challenge_id AND p.status = 'approved'
    GROUP BY p.id, p.author_id
    ORDER BY avg_score DESC, rating_count DESC
  LOOP
    v_rank := v_rank + 1;

    INSERT INTO public.xp_logs (user_id, action_type, resource_id, xp_amount)
    VALUES (v_ranked.author_id, 'challenge_participation', p_challenge_id::text, 20)
    ON CONFLICT DO NOTHING;

    UPDATE public.profiles SET xp = xp + 20 WHERE id = v_ranked.author_id;

    IF v_rank <= 3 THEN
      v_coins := CASE v_rank WHEN 1 THEN 20 WHEN 2 THEN 10 WHEN 3 THEN 5 END;

      INSERT INTO public.coin_logs (user_id, amount, action_type, resource_id, counterparty_display_text)
      VALUES (
        v_ranked.author_id,
        v_coins,
        'challenge_prize',
        p_challenge_id::text,
        '挑战第' || v_rank || '名奖励'
      );

      UPDATE public.profiles SET coins = coins + v_coins WHERE id = v_ranked.author_id;
    END IF;

    v_results := v_results || jsonb_build_object(
      'rank', v_rank,
      'project_id', v_ranked.project_id,
      'author_id', v_ranked.author_id,
      'avg_score', round(v_ranked.avg_score, 2),
      'rating_count', v_ranked.rating_count
    );
  END LOOP;

  UPDATE public.challenges SET status = 'ended' WHERE id = p_challenge_id;

  RETURN jsonb_build_object('rankings', v_results, 'total_submissions', v_rank);
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_timed_challenge(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_timed_challenge(bigint) TO service_role;
