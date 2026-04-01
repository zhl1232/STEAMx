-- ============================================
-- 观察记录互动：点赞 + 评论
-- ============================================

-- 1) observation_events 增加互动计数字段
ALTER TABLE public.observation_events
ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.observation_events
ADD COLUMN IF NOT EXISTS comments_count integer NOT NULL DEFAULT 0;

-- 2) observation_likes 表
CREATE TABLE IF NOT EXISTS public.observation_likes (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  observation_event_id bigint REFERENCES public.observation_events(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (user_id, observation_event_id)
);

ALTER TABLE public.observation_likes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_observation_likes_event_id
  ON public.observation_likes(observation_event_id);

CREATE POLICY "Observation likes are viewable by everyone"
  ON public.observation_likes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can like observations"
  ON public.observation_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike own observation likes"
  ON public.observation_likes FOR DELETE
  USING (auth.uid() = user_id);

-- 3) observation_comments 表
CREATE TABLE IF NOT EXISTS public.observation_comments (
  id bigserial PRIMARY KEY,
  observation_event_id bigint REFERENCES public.observation_events(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL CHECK (char_length(content) <= 2000),
  parent_id bigint REFERENCES public.observation_comments(id) ON DELETE CASCADE,
  reply_to_user_id uuid,
  reply_to_username text,
  likes_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.observation_comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_observation_comments_event_id
  ON public.observation_comments(observation_event_id);

CREATE INDEX IF NOT EXISTS idx_observation_comments_author_id
  ON public.observation_comments(author_id);

CREATE POLICY "Observation comments are viewable by everyone"
  ON public.observation_comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create observation comments"
  ON public.observation_comments FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own observation comments"
  ON public.observation_comments FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Users can delete own observation comments"
  ON public.observation_comments FOR DELETE
  USING (auth.uid() = author_id);

-- 4) RPC functions for observation likes count
CREATE OR REPLACE FUNCTION public.increment_observation_likes(target_observation_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.observation_events
  SET likes_count = COALESCE(likes_count, 0) + 1
  WHERE id = target_observation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_observation_likes(target_observation_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.observation_events
  SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0)
  WHERE id = target_observation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_observation_likes(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_observation_likes(bigint) TO authenticated;

-- 5) RPC functions for observation comments count
CREATE OR REPLACE FUNCTION public.increment_observation_comments(target_observation_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.observation_events
  SET comments_count = COALESCE(comments_count, 0) + 1
  WHERE id = target_observation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_observation_comments(target_observation_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.observation_events
  SET comments_count = GREATEST(COALESCE(comments_count, 0) - 1, 0)
  WHERE id = target_observation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_observation_comments(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_observation_comments(bigint) TO authenticated;
