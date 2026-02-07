-- 1. 用户通知偏好：是否接收「关注的人发布新作品」站内信
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notify_followed_creator_updates boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.notify_followed_creator_updates IS '是否接收关注的人发布/更新作品时的站内信通知';

-- 2. 允许通知类型包含 creator_update（关注的人有新作品）
-- 若已有 type 的 CHECK 约束，先删除再重建（兼容常见命名）
DO $$
DECLARE
  conname text;
BEGIN
  FOR conname IN
    SELECT c.conname FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'notifications' AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS %I', conname);
  END LOOP;
END $$;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN ('mention', 'reply', 'like', 'follow', 'system', 'creator_update'));
