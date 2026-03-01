-- 记录用户最近一次上传的头像 URL，即使用户改回预设头像也保留，便于在「选择头像」里始终显示「已上传」一格
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_uploaded_avatar_url text;

COMMENT ON COLUMN public.profiles.last_uploaded_avatar_url IS '最近一次上传的自定义头像 URL（Storage），不随切换预设而清除，用于头像选择器展示';
