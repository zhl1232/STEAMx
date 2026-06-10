-- 统一 AI 导师「小迪」对话表 + 长期记忆笔记本；从 challenge_tutor_messages 迁移历史数据。

CREATE TABLE IF NOT EXISTS public.tutor_messages (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  context_type varchar(24) NOT NULL CHECK (
    context_type IN ('global', 'challenge', 'project', 'observation', 'course')
  ),
  context_id text NOT NULL DEFAULT '',
  role varchar(12) NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  images text[],
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_messages_user_context_created
ON public.tutor_messages(user_id, context_type, context_id, created_at);

CREATE INDEX IF NOT EXISTS idx_tutor_messages_user_created
ON public.tutor_messages(user_id, created_at DESC);

ALTER TABLE public.tutor_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tutor_messages_select"
ON public.tutor_messages FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  )
);

CREATE POLICY "tutor_messages_insert"
ON public.tutor_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tutor_messages_delete"
ON public.tutor_messages FOR DELETE
USING (auth.uid() = user_id);

-- 小迪的笔记本：每人一份长期记忆摘要（service role 写入）
CREATE TABLE IF NOT EXISTS public.tutor_notebooks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  last_message_id bigint,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tutor_notebooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tutor_notebooks_select_own"
ON public.tutor_notebooks FOR SELECT
USING (auth.uid() = user_id);

-- 从旧表迁移（若存在）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'challenge_tutor_messages'
  ) THEN
    INSERT INTO public.tutor_messages (
      user_id, context_type, context_id, role, content, images, meta, created_at
    )
    SELECT
      user_id,
      'challenge',
      challenge_id::text,
      role,
      content,
      images,
      CASE
        WHEN stage_index IS NOT NULL THEN jsonb_build_object('stageIndex', stage_index)
        ELSE '{}'::jsonb
      END,
      created_at
    FROM public.challenge_tutor_messages;

    DROP TABLE public.challenge_tutor_messages;
  END IF;
END $$;

COMMENT ON TABLE public.tutor_messages IS 'AI 导师小迪统一对话记录，按用户+场景上下文分组。';
COMMENT ON TABLE public.tutor_notebooks IS '小迪对每位学生的长期记忆摘要（单文档）。';
