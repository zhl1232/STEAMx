-- Expose course-lesson and unified-work counters from get_user_stats_summary so the
-- onboarding tasks can follow the brick-course mainline (pick a lesson -> build it ->
-- upload the photo). projectsCompleted stays project-only for badge back-compat;
-- worksPublished is the union of project finals and course-lesson works.

CREATE OR REPLACE FUNCTION public.get_user_stats_summary(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
    v_lessons_started INT;
    v_lessons_completed INT;
    v_works_published INT;
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

    -- 五条产出路径统一口径：项目终稿 + 课时作品都算「作品」
    SELECT count(*) INTO v_works_published
    FROM public.completed_projects cp
    WHERE cp.user_id = target_user_id
      AND cp.status = 'approved'
      AND COALESCE(cp.record_kind, 'final') = 'final';

    SELECT
        count(*),
        count(*) FILTER (WHERE ulp.completed_at IS NOT NULL)
    INTO v_lessons_started, v_lessons_completed
    FROM public.user_lesson_progress ulp
    WHERE ulp.user_id = target_user_id;

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

    -- 与 lib/observations/observed-species-progress.ts 口径一致：
    -- 有共识用共识；无共识时计入 active AI 且 confidence >= 0.8
    SELECT count(DISTINCT species_id) INTO v_species_observed
    FROM (
      SELECT oes.species_id
      FROM public.observation_event_species oes
      JOIN public.observation_events oe ON oe.id = oes.observation_event_id
      WHERE oe.user_id = target_user_id
        AND oe.status = 'approved'

      UNION

      SELECT oi.species_id
      FROM public.observation_identifications oi
      JOIN public.observation_events oe ON oe.id = oi.observation_event_id
      WHERE oe.user_id = target_user_id
        AND oe.status = 'approved'
        AND oi.is_active = TRUE
        AND oi.source = 'ai'
        AND oi.confidence >= 0.8
        AND NOT EXISTS (
          SELECT 1
          FROM public.observation_event_species oes2
          WHERE oes2.observation_event_id = oe.id
        )
    ) observed_species;

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
        'growthTasksGraduated', COALESCE(v_growth_tasks_graduated, false),
        'lessonsStarted', COALESCE(v_lessons_started, 0),
        'lessonsCompleted', COALESCE(v_lessons_completed, 0),
        'worksPublished', COALESCE(v_works_published, 0)
    );

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_stats_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_stats_summary(UUID) TO service_role;
