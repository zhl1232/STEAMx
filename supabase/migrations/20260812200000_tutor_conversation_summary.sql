-- 两层记忆之一：会话滚动摘要。
-- 上下文窗口（最近 12 条）之外的早期消息由后台任务压缩进 summary，
-- summary_message_id 记录摘要已覆盖到的最后一条消息，兼作乐观并发锚点。

ALTER TABLE public.tutor_conversations
  ADD COLUMN IF NOT EXISTS summary text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS summary_message_id bigint;

COMMENT ON COLUMN public.tutor_conversations.summary IS '会话滚动摘要：已滑出上下文窗口的早期消息压缩记忆（约 400 字内）。';
COMMENT ON COLUMN public.tutor_conversations.summary_message_id IS '滚动摘要已覆盖到的最后一条 tutor_messages.id；更新时用作乐观并发锚点。';
