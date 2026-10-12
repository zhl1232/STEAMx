CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  requested_username text;
  attempt integer;
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

  requested_username := NULLIF(btrim(new.raw_user_meta_data->>'username'), '');
  IF requested_username IS NULL OR char_length(requested_username) < 3
    OR EXISTS (SELECT 1 FROM public.profiles WHERE username = requested_username AND id <> new.id)
  THEN
    requested_username := 'user_' || substr(md5(gen_random_uuid()::text), 1, 8);
  END IF;

  FOR attempt IN 1..5 LOOP
    BEGIN
      INSERT INTO public.profiles (id, username, display_name, avatar_url)
      VALUES (new.id, requested_username, safe_display_name, default_avatar)
      ON CONFLICT (id) DO NOTHING;
      RETURN new;
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 5 THEN RAISE; END IF;
      requested_username := 'user_' || substr(md5(gen_random_uuid()::text), 1, 8);
    END;
  END LOOP;
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Profile recovery must never abort auth.users insertion. Do not log metadata.
  RAISE WARNING 'handle_new_user failed (SQLSTATE %)', SQLSTATE;
  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user()
IS '创建新用户 profile；手机号验证不等同于本人年龄确认';

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Do not DROP TRIGGER IF EXISTS: production postgres has TRIGGER privilege,
-- but supabase_auth_admin owns auth.users. DROP requires table ownership when
-- the trigger exists; IF EXISTS only skips DROP when it does not exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'auth.users'::pg_catalog.regclass
      AND tgname = 'on_auth_user_created'
  ) THEN
    RAISE NOTICE 'on_auth_user_created already exists; skipping';
  ELSE
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END;
$$;
