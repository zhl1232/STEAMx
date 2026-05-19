-- 探索记录评论支持回复（与 observation_comments 对齐）

ALTER TABLE public.completion_comments
  ADD COLUMN IF NOT EXISTS parent_id bigint REFERENCES public.completion_comments(id) ON DELETE CASCADE;

ALTER TABLE public.completion_comments
  ADD COLUMN IF NOT EXISTS reply_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.completion_comments
  ADD COLUMN IF NOT EXISTS reply_to_username text;

CREATE INDEX IF NOT EXISTS idx_completion_comments_parent_id
  ON public.completion_comments (parent_id);

CREATE INDEX IF NOT EXISTS idx_completion_comments_completed_project_id
  ON public.completion_comments (completed_project_id, created_at);
