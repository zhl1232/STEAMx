-- 将 profiles.avatar_url 中为完整 URL（如 Supabase Storage、OAuth 第三方）的改为本地默认头像路径
-- 本地路径格式：/avatars/default-N.svg（与 handle_new_user 一致，按 id 哈希选 1–8）

UPDATE public.profiles
SET avatar_url = '/avatars/default-' || (1 + (abs(hashtext(id::text)) % 8)) || '.svg'
WHERE avatar_url IS NOT NULL
  AND trim(avatar_url) <> ''
  AND (avatar_url LIKE 'http://%' OR avatar_url LIKE 'https://%');

-- 列说明：头像可为本地路径 /avatars/... 或上传后的 Storage 公开 URL
