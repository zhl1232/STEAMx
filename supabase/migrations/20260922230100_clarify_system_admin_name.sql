-- Clarify the seeded administrator display name as requested.
-- Keep custom names, permissions, and other accounts intact.
BEGIN;

UPDATE public.profiles
SET display_name = '系统管理员'
WHERE id = '66020423-0000-0000-0000-000000000000'
  AND role = 'admin'
  AND display_name = '管理员';

UPDATE auth.users AS account
SET raw_user_meta_data = jsonb_set(account.raw_user_meta_data, '{full_name}', '"系统管理员"'::jsonb)
WHERE account.id = '66020423-0000-0000-0000-000000000000'
  AND account.raw_user_meta_data ->> 'full_name' = '管理员'
  AND EXISTS (
    SELECT 1 FROM public.profiles AS profile
    WHERE profile.id = account.id
      AND profile.role = 'admin'
      AND profile.display_name = '系统管理员'
  );

COMMIT;
