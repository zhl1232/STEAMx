-- Add RPC for aggregating user stats to reduce network requests
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
    
    -- Categories
    v_science_completed INT;
    v_tech_completed INT;
    v_engineering_completed INT;
    v_art_completed INT;
    v_math_completed INT;

    -- Login stats
    v_login_days INT;
    v_consecutive_days INT;

BEGIN
    -- 1. Projects Published
    SELECT count(*) INTO v_published_count FROM public.projects WHERE author_id = target_user_id;

    -- 2. Comments
    SELECT count(*) INTO v_comments_count FROM public.comments WHERE author_id = target_user_id;

    -- 3. Likes Given
    SELECT count(*) INTO v_likes_given_count FROM public.likes WHERE user_id = target_user_id;

    -- 4. Challenges
    SELECT count(*) INTO v_challenges_count FROM public.challenge_participants WHERE user_id = target_user_id;

    -- 5. Discussions
    SELECT count(*) INTO v_discussions_count FROM public.discussions WHERE author_id = target_user_id;

    -- 6. Replies
    SELECT count(*) INTO v_replies_count FROM public.discussion_replies WHERE author_id = target_user_id;

    -- 7. Completed Projects & Categories
    SELECT 
        count(*),
        count(*) FILTER (WHERE p.category = '科学'),
        count(*) FILTER (WHERE p.category = '技术'),
        count(*) FILTER (WHERE p.category = '工程'),
        count(*) FILTER (WHERE p.category = '艺术'),
        count(*) FILTER (WHERE p.category = '数学')
    INTO 
        v_completed_count,
        v_science_completed,
        v_tech_completed,
        v_engineering_completed,
        v_art_completed,
        v_math_completed
    FROM public.completed_projects cp
    JOIN public.projects p ON cp.project_id = p.id
    WHERE cp.user_id = target_user_id;

    -- 8. Likes Received
    SELECT COALESCE(SUM(likes_count), 0) INTO v_likes_received_count 
    FROM public.projects 
    WHERE author_id = target_user_id;

    -- 9. Collections
    SELECT count(*) INTO v_collections_count FROM public.collections WHERE user_id = target_user_id;

    -- 10. Login Stats (Call existing RPC)
    -- Wrap in logic to handle potential missing function or errors gently
    BEGIN
        SELECT login_days, consecutive_days INTO v_login_days, v_consecutive_days
        FROM public.get_user_login_stats(target_user_id) LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        v_login_days := 0;
        v_consecutive_days := 0;
    END;
    
    v_login_days := COALESCE(v_login_days, 0);
    v_consecutive_days := COALESCE(v_consecutive_days, 0);

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
        'consecutiveDays', v_consecutive_days
    );

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_stats_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_stats_summary(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
