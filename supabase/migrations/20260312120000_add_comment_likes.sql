-- ============================================
-- 评论点赞：comment_likes 表 + comments.likes_count
-- ============================================

-- 1) 评论表增加点赞数
ALTER TABLE public.comments
ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0;

-- 2) 评论点赞表
CREATE TABLE IF NOT EXISTS public.comment_likes (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  comment_id bigint REFERENCES public.comments(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (user_id, comment_id)
);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id
  ON public.comment_likes(comment_id);

-- 3) RLS policies
CREATE POLICY "Comment likes are viewable by everyone"
  ON public.comment_likes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can like comments"
  ON public.comment_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike own comment likes"
  ON public.comment_likes FOR DELETE
  USING (auth.uid() = user_id);

-- 4) RPC functions to update likes_count safely under RLS
CREATE OR REPLACE FUNCTION public.increment_comment_likes(comment_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.comments
  SET likes_count = COALESCE(likes_count, 0) + 1
  WHERE id = comment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_comment_likes(comment_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.comments
  SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0)
  WHERE id = comment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_comment_likes(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_comment_likes(bigint) TO authenticated;

COMMENT ON FUNCTION public.increment_comment_likes(bigint) IS '增加评论点赞数，由 comment_likes 插入后调用';
COMMENT ON FUNCTION public.decrement_comment_likes(bigint) IS '减少评论点赞数，由 comment_likes 删除后调用';
