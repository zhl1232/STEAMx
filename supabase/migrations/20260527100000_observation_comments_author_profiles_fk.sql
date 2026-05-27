-- PostgREST embed (profiles:author_id) requires FK observation_comments.author_id -> public.profiles(id).
-- Originally author_id referenced auth.users, which cannot be embedded as profiles.

INSERT INTO public.profiles (id, username, display_name, avatar_url)
SELECT
  auth_user.id,
  NULLIF(auth_user.raw_user_meta_data->>'username', ''),
  COALESCE(
    NULLIF(auth_user.raw_user_meta_data->>'full_name', ''),
    NULLIF(auth_user.raw_user_meta_data->>'username', '')
  ),
  '/avatars/default-' || (1 + (abs(hashtext(auth_user.id::text)) % 12)) || '.svg'
FROM auth.users AS auth_user
INNER JOIN (
  SELECT DISTINCT author_id AS id
  FROM public.observation_comments
) AS required_ids
  ON required_ids.id = auth_user.id
LEFT JOIN public.profiles AS profile
  ON profile.id = auth_user.id
WHERE profile.id IS NULL
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.observation_comments
  DROP CONSTRAINT IF EXISTS observation_comments_author_id_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'observation_comments_author_id_fkey_profiles'
      AND conrelid = 'public.observation_comments'::regclass
  ) THEN
    ALTER TABLE public.observation_comments
    ADD CONSTRAINT observation_comments_author_id_fkey_profiles
    FOREIGN KEY (author_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE;
  END IF;
END $$;
