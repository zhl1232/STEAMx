-- Ensure profile bio exists for profile settings, growth tasks, and public profiles.
-- Some older deployments had code reading profiles.bio before a dedicated schema
-- migration added the column, which makes profile APIs fail with "column bio does not exist".

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text;

COMMENT ON COLUMN public.profiles.bio IS '用户个人简介，用于个人主页与成长任务。';
