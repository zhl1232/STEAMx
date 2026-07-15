-- 授权通用竞速房间私有 Realtime channel。
-- channel 命名：race-match:<match_id>（私有 channel）
-- 订阅者必须是该房间 host 或 guest 才允许 join。

DROP POLICY IF EXISTS "Users can subscribe to own playground race channel" ON realtime.messages;

CREATE POLICY "Users can subscribe to own playground race channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'race-match:%'
  AND EXISTS (
    SELECT 1
    FROM public.playground_race_matches m
    WHERE m.id = (
      substring(realtime.topic() FROM 'race-match:([-0-9a-f]{36})')::uuid
    )
    AND (
      m.host_user_id = (SELECT auth.uid())
      OR m.guest_user_id = (SELECT auth.uid())
    )
  )
);
