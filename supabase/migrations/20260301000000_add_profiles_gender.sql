-- Add optional gender column to profiles (user-editable, not protected by trigger)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender text;

COMMENT ON COLUMN public.profiles.gender IS '用户性别：男/女/其他/不愿透露';
