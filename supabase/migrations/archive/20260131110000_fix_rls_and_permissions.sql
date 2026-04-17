-- Fix permissions and RLS for completion interactions

-- 1. Ensure permissions are granted
GRANT SELECT, INSERT, UPDATE, DELETE ON public.completion_comments TO authenticated;
GRANT SELECT ON public.completion_comments TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.completion_likes TO authenticated;
GRANT SELECT ON public.completion_likes TO anon;

-- 2. Force Enable RLS
ALTER TABLE public.completion_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.completion_likes ENABLE ROW LEVEL SECURITY;

-- 3. Re-create Policies for Comments
DROP POLICY IF EXISTS "Anyone can view completion comments" ON public.completion_comments;
CREATE POLICY "Anyone can view completion comments"
    ON public.completion_comments FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can create completion comments" ON public.completion_comments;
CREATE POLICY "Authenticated users can create completion comments"
    ON public.completion_comments FOR INSERT
    WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can delete their own completion comments" ON public.completion_comments;
CREATE POLICY "Users can delete their own completion comments"
    ON public.completion_comments FOR DELETE
    USING (auth.uid() = author_id);

-- 4. Re-create Policies for Likes
DROP POLICY IF EXISTS "Anyone can view completion likes" ON public.completion_likes;
CREATE POLICY "Anyone can view completion likes"
    ON public.completion_likes FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can like completions" ON public.completion_likes;
CREATE POLICY "Authenticated users can like completions"
    ON public.completion_likes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can unlike completions" ON public.completion_likes;
CREATE POLICY "Authenticated users can unlike completions"
    ON public.completion_likes FOR DELETE
    USING (auth.uid() = user_id);

-- 5. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
