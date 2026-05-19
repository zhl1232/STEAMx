-- 完成项目数 / 徽章 / 成长任务：只统计「终稿且已通过」，过程帖不计入

CREATE OR REPLACE FUNCTION public.get_user_stats_summary(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
    v_published_count INT;
    v_comments_count INT;
    v_likes_given_count INT;
    v_challenges_count INT;
    v_discussions_count INT;
    v_replies_count INT;
    v_completed_count INT;
    v_likes_received_count INT;
    v_collections_count INT;
    v_science_completed INT;
    v_tech_completed INT;
    v_engineering_completed INT;
    v_art_completed INT;
    v_math_completed INT;
    v_login_days INT;
    v_consecutive_days INT;
    v_observations_submitted INT;
    v_species_observed INT;
    v_observation_streak INT;
    v_growth_tasks_graduated BOOLEAN;
BEGIN
    SELECT count(*) INTO v_published_count FROM public.projects WHERE author_id = target_user_id;
    SELECT count(*) INTO v_comments_count FROM public.comments WHERE author_id = target_user_id;
    SELECT count(*) INTO v_likes_given_count FROM public.likes WHERE user_id = target_user_id;
    SELECT count(*) INTO v_challenges_count FROM public.challenge_participants WHERE user_id = target_user_id;
    SELECT count(*) INTO v_discussions_count FROM public.discussions WHERE author_id = target_user_id;
    SELECT count(*) INTO v_replies_count FROM public.discussion_replies WHERE author_id = target_user_id;

    -- 按「项目」去重：仅终稿 + approved（过程帖 progress 不计入完成数）
    SELECT
        count(DISTINCT cp.project_id),
        count(DISTINCT cp.project_id) FILTER (WHERE p.category = '科学'),
        count(DISTINCT cp.project_id) FILTER (WHERE p.category = '技术'),
        count(DISTINCT cp.project_id) FILTER (WHERE p.category = '工程'),
        count(DISTINCT cp.project_id) FILTER (WHERE p.category = '艺术'),
        count(DISTINCT cp.project_id) FILTER (WHERE p.category = '数学')
    INTO
        v_completed_count,
        v_science_completed,
        v_tech_completed,
        v_engineering_completed,
        v_art_completed,
        v_math_completed
    FROM public.completed_projects cp
    JOIN public.projects p ON cp.project_id = p.id
    WHERE cp.user_id = target_user_id
      AND cp.status = 'approved'
      AND COALESCE(cp.record_kind, 'final') = 'final';

    SELECT COALESCE(SUM(likes_count), 0) INTO v_likes_received_count
    FROM public.projects
    WHERE author_id = target_user_id;

    SELECT count(*) INTO v_collections_count FROM public.collections WHERE user_id = target_user_id;

    BEGIN
        SELECT login_days, consecutive_days INTO v_login_days, v_consecutive_days
        FROM public.get_user_login_stats(target_user_id) LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        v_login_days := 0;
        v_consecutive_days := 0;
    END;

    v_login_days := COALESCE(v_login_days, 0);
    v_consecutive_days := COALESCE(v_consecutive_days, 0);

    SELECT count(*) INTO v_observations_submitted
    FROM public.observation_events
    WHERE user_id = target_user_id
      AND status = 'approved';

    SELECT count(DISTINCT oes.species_id) INTO v_species_observed
    FROM public.observation_event_species oes
    JOIN public.observation_events oe ON oe.id = oes.observation_event_id
    WHERE oe.user_id = target_user_id
      AND oe.status = 'approved';

    WITH daily AS (
        SELECT DISTINCT (observed_at AT TIME ZONE 'Asia/Shanghai')::date AS obs_date
        FROM public.observation_events
        WHERE user_id = target_user_id
          AND status = 'approved'
    ),
    numbered AS (
        SELECT obs_date, obs_date - (ROW_NUMBER() OVER (ORDER BY obs_date))::int AS grp
        FROM daily
    ),
    streaks AS (
        SELECT grp, count(*) AS streak_len, max(obs_date) AS streak_end
        FROM numbered
        GROUP BY grp
    )
    SELECT COALESCE(
        (SELECT streak_len FROM streaks WHERE streak_end >= (CURRENT_DATE AT TIME ZONE 'Asia/Shanghai')::date - 1 ORDER BY streak_len DESC LIMIT 1),
        0
    ) INTO v_observation_streak;

    SELECT EXISTS (
        SELECT 1
        FROM public.xp_logs
        WHERE user_id = target_user_id
          AND action_type = 'profile_growth_task_graduation'
          AND resource_id = 'v1'
    ) INTO v_growth_tasks_graduated;

    result := jsonb_build_object(
        'projectsPublished', v_published_count,
        'projectsLiked', v_likes_given_count,
        'projectsCompleted', v_completed_count,
        'commentsCount', v_comments_count,
        'scienceCompleted', COALESCE(v_science_completed, 0),
        'techCompleted', COALESCE(v_tech_completed, 0),
        'engineeringCompleted', COALESCE(v_engineering_completed, 0),
        'artCompleted', COALESCE(v_art_completed, 0),
        'mathCompleted', COALESCE(v_math_completed, 0),
        'likesGiven', v_likes_given_count,
        'likesReceived', v_likes_received_count,
        'collectionsCount', v_collections_count,
        'challengesJoined', v_challenges_count,
        'discussionsCreated', v_discussions_count,
        'repliesCount', v_replies_count,
        'loginDays', v_login_days,
        'consecutiveDays', v_consecutive_days,
        'observationsSubmitted', COALESCE(v_observations_submitted, 0),
        'speciesObserved', COALESCE(v_species_observed, 0),
        'observationStreak', COALESCE(v_observation_streak, 0),
        'growthTasksGraduated', COALESCE(v_growth_tasks_graduated, false)
    );

    RETURN result;
END;
$$;

-- 学习打卡：项目完成日仅认终稿 approved，不认过程帖
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
      AND cp.status = 'approved'
      AND COALESCE(cp.record_kind, 'final') = 'final'

    UNION

    SELECT DISTINCT (oe.observed_at AT TIME ZONE 'Asia/Shanghai')::date AS event_date
    FROM public.observation_events oe
    WHERE oe.user_id = target_user_id
      AND oe.status = 'approved'

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

GRANT EXECUTE ON FUNCTION public.get_user_stats_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_stats_summary(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_study_checkin_summary(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_study_checkin_summary(UUID, INT) TO service_role;

NOTIFY pgrst, 'reload schema';
