-- 为 coin_logs、user_inventory 授予 authenticated 只读，否则 REST 会 403
-- RLS 已限制用户只能看自己的记录
GRANT SELECT ON public.coin_logs TO authenticated;
GRANT SELECT ON public.user_inventory TO authenticated;
