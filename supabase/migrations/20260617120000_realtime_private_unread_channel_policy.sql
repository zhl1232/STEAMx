-- Authorize the private Realtime channel used for notification/message unread counts.
-- This project runs with public Realtime channels restricted, so the frontend subscribes
-- to unread-counts:<user_id> as a private channel and relies on this policy at join time.

DROP POLICY IF EXISTS "Users can subscribe to own unread counts channel" ON realtime.messages;

CREATE POLICY "Users can subscribe to own unread counts channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (realtime.topic() = ('unread-counts:' || (SELECT auth.uid())::text));
