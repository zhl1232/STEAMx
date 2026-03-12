-- 评论区发图特权：
-- 1. 给 comments 和 discussion_replies 表增加 image_url 字段
-- 2. 创建 comment-images Storage Bucket + RLS 策略

ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.discussion_replies ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ========== comment-images bucket ==========
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comment-images',
  'comment-images',
  true,
  2097152,  -- 2MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 公开可读
DROP POLICY IF EXISTS "Comment images are publicly accessible" ON storage.objects;
CREATE POLICY "Comment images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'comment-images');

-- 登录用户可上传（路径必须以自己的 user_id 开头）
DROP POLICY IF EXISTS "Authenticated users can upload comment images" ON storage.objects;
CREATE POLICY "Authenticated users can upload comment images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'comment-images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 用户可删除自己的评论图片
DROP POLICY IF EXISTS "Users can delete their own comment images" ON storage.objects;
CREATE POLICY "Users can delete their own comment images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'comment-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
