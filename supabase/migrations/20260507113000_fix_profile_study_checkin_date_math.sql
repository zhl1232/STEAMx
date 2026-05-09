CREATE OR REPLACE FUNCTION public.get_user_study_checkin_summary(
  target_user_id UUID,
  window_days INT DEFAULT 6
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Asia/Shanghai')::date;
  v_window_days INT := GREATEST(COALESCE(window_days, 6), 1);
  v_anchor_date DATE;
  v_streak INT := 0;
  v_today_completed BOOLEAN := FALSE;
  v_days JSONB := '[]'::jsonb;
BEGIN
  WITH qualifying_days AS (
    SELECT DISTINCT (cp.completed_at AT TIME ZONE 'Asia/Shanghai')::date AS event_date
    FROM public.completed_projects cp
    WHERE cp.user_id = target_user_id
      AND (cp.status IS NULL OR cp.status IN ('pending', 'approved'))

    UNION

    SELECT DISTINCT (oe.observed_at AT TIME ZONE 'Asia/Shanghai')::date AS event_date
    FROM public.observation_events oe
    WHERE oe.user_id = target_user_id
      AND oe.status IN ('pending', 'approved')

    UNION

    SELECT DISTINCT (cs.created_at AT TIME ZONE 'Asia/Shanghai')::date AS event_date
    FROM public.challenge_submissions cs
    WHERE cs.user_id = target_user_id
      AND cs.status IN ('pending', 'approved')
  ),
  anchor_day AS (
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM qualifying_days WHERE event_date = v_today) THEN v_today
      WHEN EXISTS (SELECT 1 FROM qualifying_days WHERE event_date = v_today - 1) THEN v_today - 1
      ELSE NULL
    END AS streak_anchor
  ),
  ordered_days AS (
    SELECT qd.event_date, ROW_NUMBER() OVER (ORDER BY qd.event_date DESC) AS row_num
    FROM qualifying_days qd
    JOIN anchor_day ad ON ad.streak_anchor IS NOT NULL
    WHERE qd.event_date <= ad.streak_anchor
  ),
  recent_days AS (
    SELECT gs.day_date::date AS day_date
    FROM generate_series(v_today - (v_window_days - 1), v_today, interval '1 day') AS gs(day_date)
  )
  SELECT
    ad.streak_anchor,
    EXISTS (SELECT 1 FROM qualifying_days WHERE event_date = v_today),
    COALESCE((
      SELECT COUNT(*)
      FROM ordered_days od
      WHERE od.event_date = ad.streak_anchor - ((od.row_num - 1)::int)
    ), 0),
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', to_char(rd.day_date, 'YYYY-MM-DD'),
          'label', EXTRACT(MONTH FROM rd.day_date)::int::text || '.' || lpad(EXTRACT(DAY FROM rd.day_date)::int::text, 2, '0'),
          'completed', EXISTS (
            SELECT 1
            FROM qualifying_days qd
            WHERE qd.event_date = rd.day_date
          )
        )
        ORDER BY rd.day_date
      )
      FROM recent_days rd
    ), '[]'::jsonb)
  INTO v_anchor_date, v_today_completed, v_streak, v_days
  FROM anchor_day ad;

  RETURN jsonb_build_object(
    'streak', COALESCE(v_streak, 0),
    'todayCompleted', COALESCE(v_today_completed, FALSE),
    'streakThroughDate', CASE WHEN v_anchor_date IS NULL THEN NULL ELSE to_char(v_anchor_date, 'YYYY-MM-DD') END,
    'days', v_days
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_study_checkin_summary(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_study_checkin_summary(UUID, INT) TO service_role;

NOTIFY pgrst, 'reload schema';
