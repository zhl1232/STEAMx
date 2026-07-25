-- Keep phone credentials out of public profile names, including fallback profile creation.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  default_avatar text;
  requested_display_name text;
  requested_display_digits text;
  phone_digits text;
  safe_display_name text;
BEGIN
  default_avatar := '/avatars/default-' || (1 + (abs(hashtext(new.id::text)) % 12)) || '.svg';
  requested_display_name := NULLIF(btrim(new.raw_user_meta_data->>'full_name'), '');
  requested_display_digits := regexp_replace(COALESCE(requested_display_name, ''), '\D', '', 'g');
  phone_digits := regexp_replace(COALESCE(new.phone, ''), '\D', '', 'g');

  IF requested_display_name IS NULL
    OR (
      new.phone IS NOT NULL
      AND length(requested_display_digits) >= 11
      AND (
        requested_display_digits = phone_digits
        OR right(phone_digits, length(requested_display_digits)) = requested_display_digits
        OR right(requested_display_digits, length(phone_digits)) = phone_digits
      )
    )
  THEN
    safe_display_name := '新用户' || upper(substr(md5(gen_random_uuid()::text), 1, 4));
  ELSE
    safe_display_name := requested_display_name;
  END IF;

  INSERT INTO public.profiles (id, username, display_name, avatar_url, age_confirmed_at)
  VALUES (
    new.id,
    COALESCE(
      NULLIF(btrim(new.raw_user_meta_data->>'username'), ''),
      'user_' || substr(md5(gen_random_uuid()::text), 1, 8)
    ),
    safe_display_name,
    default_avatar,
    now()
  );
  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user()
IS '创建新用户 profile，分配本地默认头像，并使用不含手机号的默认昵称';
