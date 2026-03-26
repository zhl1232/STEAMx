-- S0 修复：撤销客户端对 increment_client_xp 的直接调用权限
-- 原因：authenticated 角色可绕过客户端 xp_logs 去重逻辑，直接调用 RPC 无限刷 XP
-- 修复后客户端通过 /api/xp/increment 路由调用，该路由有认证 + 限流保护

REVOKE EXECUTE ON FUNCTION public.increment_client_xp(int) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_client_xp(int) FROM anon;
