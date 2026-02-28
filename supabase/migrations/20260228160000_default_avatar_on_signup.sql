-- 新用户注册时：若未提供头像则使用项目默认 SVG 头像（/avatars/default-1.svg .. default-8.svg）
-- 用户可在个人资料中自行上传更换头像

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_avatar text;
BEGIN
  -- 若 meta 中无 avatar_url 或为空，则按 user id 哈希选一个默认头像（1-8）
  default_avatar := COALESCE(
    NULLIF(TRIM(new.raw_user_meta_data->>'avatar_url'), ''),
    '/avatars/default-' || (1 + (abs(hashtext(new.id::text)) % 8)) || '.svg'
  );

  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'full_name',
    default_avatar
  );
  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS '新用户注册时创建 profile；未提供头像时使用 /avatars/default-N.svg 之一';
