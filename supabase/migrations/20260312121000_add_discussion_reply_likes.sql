-- ============================================
-- 讨论回复点赞：discussion_reply_likes 表 + discussion_replies.likes_count
-- ============================================

-- 1) 讨论回复表增加点赞数
ALTER TABLE public.discussion_replies
ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0;

-- 2) 讨论回复点赞表
CREATE TABLE IF NOT EXISTS public.discussion_reply_likes (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reply_id bigint REFERENCES public.discussion_replies(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (user_id, reply_id)
);

ALTER TABLE public.discussion_reply_likes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_discussion_reply_likes_reply_id
  ON public.discussion_reply_likes(reply_id);

-- 3) RLS policies
CREATE POLICY "Discussion reply likes are viewable by everyone"
  ON public.discussion_reply_likes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can like discussion replies"
  ON public.discussion_reply_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike own discussion reply likes"
  ON public.discussion_reply_likes FOR DELETE
  USING (auth.uid() = user_id);

-- 4) RPC functions to update likes_count safely under RLS
CREATE OR REPLACE FUNCTION public.increment_discussion_reply_likes(reply_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.discussion_replies
  SET likes_count = COALESCE(likes_count, 0) + 1
  WHERE id = reply_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_discussion_reply_likes(reply_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.discussion_replies
  SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0)
  WHERE id = reply_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_discussion_reply_likes(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_discussion_reply_likes(bigint) TO authenticated;

COMMENT ON FUNCTION public.increment_discussion_reply_likes(bigint) IS '增加讨论回复点赞数，由 discussion_reply_likes 插入后调用';
COMMENT ON FUNCTION public.decrement_discussion_reply_likes(bigint) IS '减少讨论回复点赞数，由 discussion_reply_likes 删除后调用';
