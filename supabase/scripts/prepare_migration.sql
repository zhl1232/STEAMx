-- ============================================================
-- 迁移准备脚本
-- 请在导入数据之前，在【目标】Supabase SQL 编辑器中运行此脚本。
-- ============================================================

DO $$
DECLARE
  -- ⚠️ 请将此处替换为您在新项目中的管理员 User ID ⚠️
  -- 您可以在 Authentication -> Users 中找到您的 UUID。
  target_admin_id uuid := 'fc9f4384-2bb5-418e-a2e2-8c29bff6e7c5'; 
BEGIN
  -- 1. 验证
  IF target_admin_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
     RAISE EXCEPTION '❌ 请在脚本中将 target_admin_id 替换为您的实际 User UUID！';
  END IF;

  -- 2. 确保管理员 Profile 存在
  -- 'projects' 表需要一个存在于 'profiles' 表中的有效 author_id。
  -- 如果管理员不存在 profile，我们将创建一个占位符。
  INSERT INTO public.profiles (id, username, display_name, avatar_url, role)
  VALUES (
    target_admin_id, 
    'admin_migrator', 
    'System Admin', 
    '/avatars/default-1.svg',
    'admin'
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    display_name = EXCLUDED.display_name,
    role = 'admin' -- 确保即使用户已存在，也将其提升为管理员
  WHERE profiles.display_name IS NULL OR profiles.role != 'admin';

  RAISE NOTICE '✅ 已为 ID: % 准备好管理员 Profile', target_admin_id;
  RAISE NOTICE '🚀 您现在可以导入修改后的 CSV 文件了。';

END $$;
