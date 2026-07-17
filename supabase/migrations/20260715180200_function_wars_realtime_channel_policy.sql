-- Private channel topic: function-wars-match:<match_uuid>.
-- Only the host or guest of that row may subscribe.

DROP POLICY IF EXISTS "Users can subscribe to own function wars match channel"
  ON realtime.messages;

CREATE POLICY "Users can subscribe to own function wars match channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'function-wars-match:%'
  AND EXISTS (
    SELECT 1
    FROM public.function_wars_matches AS match
    WHERE match.id = (
      substring(
        realtime.topic()
        FROM 'function-wars-match:([-0-9a-f]{36})'
      )::uuid
    )
    AND (
      match.host_user_id = (SELECT auth.uid())
      OR match.guest_user_id = (SELECT auth.uid())
    )
  )
);
