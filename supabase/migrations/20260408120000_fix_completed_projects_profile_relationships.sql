-- Ensure completed_projects can be embedded with profiles/project relations in PostgREST.
-- Old rows point to auth.users, but admin queries embed public.profiles via user_id/reviewed_by.

WITH required_profile_ids AS (
  SELECT user_id AS id
  FROM public.completed_projects

  UNION

  SELECT reviewed_by AS id
  FROM public.completed_projects
  WHERE reviewed_by IS NOT NULL

  UNION

  SELECT user_id AS id
  FROM public.moderator_applications

  UNION

  SELECT reviewed_by AS id
  FROM public.moderator_applications
  WHERE reviewed_by IS NOT NULL
)
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
INNER JOIN required_profile_ids AS required_ids
  ON required_ids.id = auth_user.id
LEFT JOIN public.profiles AS profile
  ON profile.id = auth_user.id
WHERE profile.id IS NULL
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'completed_projects_user_id_fkey_profiles'
      AND conrelid = 'public.completed_projects'::regclass
  ) THEN
    ALTER TABLE public.completed_projects
    ADD CONSTRAINT completed_projects_user_id_fkey_profiles
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'completed_projects_reviewed_by_fkey_profiles'
      AND conrelid = 'public.completed_projects'::regclass
  ) THEN
    ALTER TABLE public.completed_projects
    ADD CONSTRAINT completed_projects_reviewed_by_fkey_profiles
    FOREIGN KEY (reviewed_by)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'moderator_applications_user_id_fkey_profiles'
      AND conrelid = 'public.moderator_applications'::regclass
  ) THEN
    ALTER TABLE public.moderator_applications
    ADD CONSTRAINT moderator_applications_user_id_fkey_profiles
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'moderator_applications_reviewed_by_fkey_profiles'
      AND conrelid = 'public.moderator_applications'::regclass
  ) THEN
    ALTER TABLE public.moderator_applications
    ADD CONSTRAINT moderator_applications_reviewed_by_fkey_profiles
    FOREIGN KEY (reviewed_by)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;
  END IF;
END $$;
