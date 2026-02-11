-- Dynamic Badges: remove old badge IDs and their user_badges references.
-- Run this AFTER applying 20260211100001_dynamic_badges_insert.sql and running the backfill script.

-- Old badge IDs (legacy, no longer in the new 77-badge set)
DO $$
DECLARE
  old_ids text[] := ARRAY[
    'curious_mind', 'quick_learner',
    'science_beginner', 'science_enthusiast', 'junior_scientist', 'science_explorer', 'science_researcher',
    'science_expert', 'science_master', 'science_professor', 'science_genius', 'science_legend',
    'tech_beginner', 'tech_enthusiast', 'junior_coder', 'tech_explorer', 'tech_developer',
    'tech_expert', 'tech_master', 'tech_architect', 'tech_genius', 'tech_legend',
    'engineering_beginner', 'engineering_enthusiast', 'junior_engineer', 'engineering_explorer',
    'engineering_builder', 'engineering_expert', 'engineering_master', 'engineering_chief',
    'engineering_genius', 'engineering_legend',
    'art_beginner', 'art_enthusiast', 'junior_artist', 'art_explorer', 'art_creator',
    'art_expert', 'art_master', 'art_virtuoso', 'art_genius', 'art_legend',
    'math_beginner', 'math_enthusiast', 'junior_mathematician', 'math_explorer', 'math_solver',
    'math_expert', 'math_master', 'math_professor', 'math_genius', 'math_legend',
    'creator_starter', 'creator', 'active_creator', 'prolific_creator', 'master_creator',
    'content_king', 'creative_genius', 'publishing_legend', 'content_emperor', 'legendary_author',
    'commenter', 'helpful', 'active_commenter', 'super_commenter', 'comment_king',
    'discussion_starter', 'discussion_leader', 'reply_master', 'community_pillar', 'social_legend',
    'like_giver', 'super_liker', 'like_machine', 'like_legend',
    'popular_one', 'rising_star', 'super_star', 'mega_star',
    'collector', 'super_collector',
    'milestone_5', 'master', 'milestone_25', 'milestone_50', 'milestone_100',
    'all_rounder', 'versatile_master', 'steam_polymath', 'ultimate_achiever', 'legendary_achiever',
    'level_5', 'level_10', 'level_15', 'level_20', 'level_30', 'level_40', 'level_50',
    'level_75', 'level_100', 'level_max',
    'challenger', 'challenge_enthusiast', 'challenge_veteran', 'challenge_master',
    'challenge_champion', 'challenge_legend',
    'week_streak', 'month_streak', 'quarter_streak', 'half_year_streak', 'year_streak'
  ];
BEGIN
  DELETE FROM public.user_badges WHERE badge_id = ANY(old_ids);
  DELETE FROM public.badges WHERE id = ANY(old_ids);
  RAISE NOTICE 'Removed old badge references and % old badge rows', array_length(old_ids, 1);
END $$;
