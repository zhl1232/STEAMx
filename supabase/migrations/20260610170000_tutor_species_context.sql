-- 小迪导师：物种档案页独立对话上下文（按 species slug 分组）

ALTER TABLE public.tutor_messages DROP CONSTRAINT IF EXISTS tutor_messages_context_type_check;

ALTER TABLE public.tutor_messages
  ADD CONSTRAINT tutor_messages_context_type_check
  CHECK (
    context_type IN ('global', 'challenge', 'project', 'observation', 'course', 'species')
  );
