-- Discussion likes table (same pattern as comment_likes / discussion_reply_likes)
CREATE TABLE IF NOT EXISTS public.discussion_likes (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  discussion_id integer NOT NULL REFERENCES public.discussions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, discussion_id)
);

CREATE INDEX IF NOT EXISTS idx_discussion_likes_discussion_id ON public.discussion_likes(discussion_id);

ALTER TABLE public.discussion_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all discussion likes"
  ON public.discussion_likes FOR SELECT USING (true);

CREATE POLICY "Users can insert own discussion likes"
  ON public.discussion_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own discussion likes"
  ON public.discussion_likes FOR DELETE USING (auth.uid() = user_id);

-- Increment / decrement RPCs
CREATE OR REPLACE FUNCTION public.increment_discussion_likes(discussion_id integer)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.discussions SET likes_count = likes_count + 1 WHERE id = discussion_id;
$$;

CREATE OR REPLACE FUNCTION public.decrement_discussion_likes(discussion_id integer)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.discussions SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = discussion_id;
$$;
