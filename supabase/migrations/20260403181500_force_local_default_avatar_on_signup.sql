-- 新用户注册时始终分配本地默认头像，避免从第三方 metadata 继承外链头像。

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_avatar text;
BEGIN
  default_avatar := '/avatars/default-' || (1 + (abs(hashtext(new.id::text)) % 12)) || '.svg';

  INSERT INTO public.profiles (id, username, display_name, avatar_url, age_confirmed_at)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'full_name',
    default_avatar,
    now()
  );
  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS '新用户注册时创建 profile，并分配本地默认头像 /avatars/default-N.svg';
