-- 持久化 PBL "AI 学习导师小思" 的一对一对话，按用户、按挑战保存（每条消息一行）。
-- DB 为聊天记录的唯一真实来源，支持跨设备、回看与后续审核/分析。

CREATE TABLE IF NOT EXISTS public.challenge_tutor_messages (
  id bigserial PRIMARY KEY,
  challenge_id bigint NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role varchar(12) NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  images text[],
  stage_index smallint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenge_tutor_messages_challenge_user_created
ON public.challenge_tutor_messages(challenge_id, user_id, created_at);

ALTER TABLE public.challenge_tutor_messages ENABLE ROW LEVEL SECURITY;

-- 本人可读写自己的对话；管理员/审核员可读全部。
CREATE POLICY "challenge_tutor_messages_select"
ON public.challenge_tutor_messages FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  )
);

CREATE POLICY "challenge_tutor_messages_insert"
ON public.challenge_tutor_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "challenge_tutor_messages_delete"
ON public.challenge_tutor_messages FOR DELETE
USING (auth.uid() = user_id);
