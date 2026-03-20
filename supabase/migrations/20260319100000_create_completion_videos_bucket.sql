-- 创建完成作品视频 Storage Bucket + RLS 策略

-- project-completion-videos - 完成作品短视频
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('project-completion-videos', 'project-completion-videos', true, 31457280)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 31457280;

-- ========== project-completion-videos 策略 ==========

DROP POLICY IF EXISTS "Completion videos are publicly accessible" ON storage.objects;
CREATE POLICY "Completion videos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-completion-videos');

DROP POLICY IF EXISTS "Authenticated users can upload completion videos" ON storage.objects;
CREATE POLICY "Authenticated users can upload completion videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-completion-videos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND storage.extension(name) IN ('mp4', 'webm')
);

DROP POLICY IF EXISTS "Users can update their own completion videos" ON storage.objects;
CREATE POLICY "Users can update their own completion videos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'project-completion-videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete their own completion videos" ON storage.objects;
CREATE POLICY "Users can delete their own completion videos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-completion-videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
