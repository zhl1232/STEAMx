-- ============================================
-- 🚀  一键重置脚本 (MASTER RESET SCRIPT)
-- ============================================
-- 仅执行数据清空，不包含结构变更或数据填充。
-- ============================================

BEGIN;

-- ============================================
-- 数据清理 (Clean Data)
-- ============================================

DELETE FROM public.discussion_replies;
DELETE FROM public.discussions;
DELETE FROM public.messages;
DELETE FROM public.user_badges;
DELETE FROM public.completed_projects;
DELETE FROM public.comments;
DELETE FROM public.collections;
DELETE FROM public.likes;
DELETE FROM public.challenge_participants;
DELETE FROM public.challenges;

DELETE FROM public.project_steps;
DELETE FROM public.project_tags;
DELETE FROM public.project_materials;
DELETE FROM public.projects;

COMMIT;

DO $$ 
BEGIN 
  RAISE NOTICE '✅ 数据已清空 (Data Cleared)。';
  RAISE NOTICE '� 请运行 20260130000001_seed_init.sql 进行数据填充。';
END $$;
