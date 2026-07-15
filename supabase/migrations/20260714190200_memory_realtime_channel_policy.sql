-- 授权记忆翻牌对局私有 Realtime channel。
-- channel 命名：memory-match:<match_id>（私有 channel）
-- 订阅者必须是该对局的 host 或 guest 才允许 join。
-- realtime.topic() 形如 'memory-match:xxxxxxxx-xxxx-...'，需解析末段 match_id 再 join memory_matches 校验。

DROP POLICY IF EXISTS "Users can subscribe to own memory match channel" ON realtime.messages;

CREATE POLICY "Users can subscribe to own memory match channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'memory-match:%'
  AND EXISTS (
    SELECT 1
    FROM public.memory_matches m
    WHERE m.id = (
      substring(realtime.topic() FROM 'memory-match:([-0-9a-f]{36})')::uuid
    )
    AND (
      m.host_user_id = (SELECT auth.uid())
      OR m.guest_user_id = (SELECT auth.uid())
    )
  )
);
