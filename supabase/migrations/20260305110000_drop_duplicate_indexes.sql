-- ============================================
-- 删除重复索引（Supabase Lint: duplicate_index）
-- 对应 Supabase Performance Security Lints (default).csv
-- 参考: https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index
-- ============================================

-- discussion_replies: idx_discussion_replies_discussion 与 idx_discussion_replies_discussion_id 同列 discussion_id，保留 _id 命名
DROP INDEX IF EXISTS public.idx_discussion_replies_discussion;

-- projects: idx_projects_created_at 与 idx_projects_created_at_desc 均为 created_at DESC，保留其一
DROP INDEX IF EXISTS public.idx_projects_created_at_desc;

-- user_badges: idx_user_badges_user_badge_unique 与主键 user_badges_pkey 在 (user_id, badge_id) 上等价，保留主键
DROP INDEX IF EXISTS public.idx_user_badges_user_badge_unique;
