-- Add private-message read state for unified message-center badges.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread_created
  ON public.messages (receiver_id, created_at DESC)
  WHERE read_at IS NULL;

DROP POLICY IF EXISTS "Users can mark received messages read" ON public.messages;
CREATE POLICY "Users can mark received messages read"
  ON public.messages FOR UPDATE
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

GRANT UPDATE (read_at) ON public.messages TO authenticated;
