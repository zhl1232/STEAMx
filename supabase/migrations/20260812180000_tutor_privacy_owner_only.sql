-- 收紧小迪对话的隐私边界：删除 admin/moderator 通过 RLS 直读全站对话的权限。
--
-- 背景：tutor_conversations / tutor_messages 保存未成年学生与 AI 导师的完整
-- 对话（含学习情况、上传图片等敏感内容）。原策略允许任何应用层
-- admin/moderator 账号携带自己的 JWT 直接 SELECT 全表，绕过任何专用接口与
-- 审计。当前代码中不存在管理端读取这两张表的功能，收紧为仅本人可读没有
-- 功能影响。
--
-- 将来如确需人工审查对话，应新建带鉴权与审计日志的服务端接口
-- （service role 查询，最小字段返回），而不是恢复 RLS 直通。

DROP POLICY IF EXISTS "tutor_conversations_select" ON public.tutor_conversations;
CREATE POLICY "tutor_conversations_select"
ON public.tutor_conversations FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tutor_messages_select" ON public.tutor_messages;
CREATE POLICY "tutor_messages_select"
ON public.tutor_messages FOR SELECT
USING (auth.uid() = user_id);
