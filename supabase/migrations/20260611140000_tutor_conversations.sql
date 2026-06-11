-- 小迪对话线程：开启新对话时归档旧线程，保留历史消息。

CREATE TABLE IF NOT EXISTS public.tutor_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  context_type varchar(24) NOT NULL CHECK (
    context_type IN ('global', 'challenge', 'project', 'observation', 'course', 'species')
  ),
  context_id text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '小迪对话',
  status varchar(12) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tutor_conversations_one_active
ON public.tutor_conversations(user_id, context_type, context_id)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_tutor_conversations_user_context_updated
ON public.tutor_conversations(user_id, context_type, context_id, updated_at DESC);

ALTER TABLE public.tutor_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tutor_conversations_select"
ON public.tutor_conversations FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  )
);

CREATE POLICY "tutor_conversations_insert"
ON public.tutor_conversations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tutor_conversations_update"
ON public.tutor_conversations FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.tutor_messages
ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.tutor_conversations(id) ON DELETE CASCADE;

INSERT INTO public.tutor_conversations (
  user_id,
  context_type,
  context_id,
  title,
  status,
  meta,
  created_at,
  updated_at
)
SELECT
  grouped.user_id,
  grouped.context_type,
  grouped.context_id,
  '历史对话',
  'active',
  '{}'::jsonb,
  grouped.first_created_at,
  grouped.last_created_at
FROM (
  SELECT
    user_id,
    context_type,
    context_id,
    MIN(created_at) AS first_created_at,
    MAX(created_at) AS last_created_at
  FROM public.tutor_messages
  WHERE conversation_id IS NULL
  GROUP BY user_id, context_type, context_id
) AS grouped
ON CONFLICT DO NOTHING;

UPDATE public.tutor_messages AS message
SET conversation_id = conversation.id
FROM public.tutor_conversations AS conversation
WHERE message.conversation_id IS NULL
  AND conversation.user_id = message.user_id
  AND conversation.context_type = message.context_type
  AND conversation.context_id = message.context_id
  AND conversation.status = 'active';

ALTER TABLE public.tutor_messages
ALTER COLUMN conversation_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tutor_messages_conversation_created
ON public.tutor_messages(conversation_id, created_at);

COMMENT ON TABLE public.tutor_conversations IS 'AI 导师小迪对话线程；开启新对话时归档旧线程并保留历史消息。';
COMMENT ON COLUMN public.tutor_messages.conversation_id IS '所属小迪对话线程。';
