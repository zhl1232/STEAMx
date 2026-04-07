-- 新用户注册时：使用项目本地默认 SVG 头像（/avatars/default-1.svg .. default-12.svg）
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
  -- 始终按 user id 哈希分配本地默认头像（1-12）
  default_avatar := '/avatars/default-' || (1 + (abs(hashtext(new.id::text)) % 12)) || '.svg';

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

COMMENT ON FUNCTION public.handle_new_user() IS '新用户注册时创建 profile，并使用 /avatars/default-N.svg 本地默认头像';
