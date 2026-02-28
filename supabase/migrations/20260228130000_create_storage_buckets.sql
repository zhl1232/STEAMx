-- 创建上传所需的 Storage Buckets（解决 "Bucket not found"）
-- 项目使用的桶: avatars, project-images, project-completions

-- 1. avatars - 用户头像
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. project-images - 项目/分享图片
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-images', 'project-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. project-completions - 完成作品证明材料
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-completions', 'project-completions', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ========== avatars 策略 ==========
DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Anyone can upload an avatar." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;
CREATE POLICY "Anyone can upload an avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Anyone can update their own avatar." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update their own avatar" ON storage.objects;
CREATE POLICY "Anyone can update their own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- ========== project-images 策略 ==========
DROP POLICY IF EXISTS "Project images are publicly accessible." ON storage.objects;
DROP POLICY IF EXISTS "Project images are publicly accessible" ON storage.objects;
CREATE POLICY "Project images are publicly accessible"
ON storage.objects FOR SELECT USING (bucket_id = 'project-images');

DROP POLICY IF EXISTS "Anyone can upload project images." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload project images" ON storage.objects;
CREATE POLICY "Anyone can upload project images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'project-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update their own project images" ON storage.objects;
CREATE POLICY "Users can update their own project images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'project-images' AND auth.uid() = owner)
WITH CHECK (bucket_id = 'project-images' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Users can delete their own project images" ON storage.objects;
CREATE POLICY "Users can delete their own project images"
ON storage.objects FOR DELETE
USING (bucket_id = 'project-images' AND auth.uid() = owner);

-- ========== project-completions 策略 ==========
DROP POLICY IF EXISTS "Completion images are publicly accessible" ON storage.objects;
CREATE POLICY "Completion images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-completions');

DROP POLICY IF EXISTS "Authenticated users can upload completion images" ON storage.objects;
CREATE POLICY "Authenticated users can upload completion images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-completions'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update their own completion images" ON storage.objects;
CREATE POLICY "Users can update their own completion images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'project-completions'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete their own completion images" ON storage.objects;
CREATE POLICY "Users can delete their own completion images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-completions'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
