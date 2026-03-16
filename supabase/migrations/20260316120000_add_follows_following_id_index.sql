-- follows 表按 following_id 查询（查询粉丝列表/计数）缺少索引
-- 主键 (follower_id, following_id) 无法覆盖此查询模式
CREATE INDEX IF NOT EXISTS idx_follows_following_id
  ON public.follows (following_id);
