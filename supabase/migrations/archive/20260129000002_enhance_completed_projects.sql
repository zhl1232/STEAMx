-- ============================================
-- 增强 completed_projects 表
-- 添加证明材料、心得和可见性字段
-- ============================================

-- 1. 添加新字段
ALTER TABLE public.completed_projects
ADD COLUMN IF NOT EXISTS proof_images text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS proof_video_url text,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true;

COMMENT ON COLUMN public.completed_projects.proof_images IS '作品证明图片URL数组';
COMMENT ON COLUMN public.completed_projects.proof_video_url IS '作品视频链接（可选）';
COMMENT ON COLUMN public.completed_projects.notes IS '制作心得';
COMMENT ON COLUMN public.completed_projects.is_public IS '是否公开展示';

-- 2. 更新 RLS 策略以支持可见性控制
-- 先删除旧的"允许所有人查看"策略
DROP POLICY IF EXISTS "Completed projects viewable by everyone" ON public.completed_projects;

-- 创建新策略：公开记录所有人可见，私有记录仅自己可见
CREATE POLICY "Completed projects visibility policy"
ON public.completed_projects FOR SELECT
USING (
    is_public = true 
    OR auth.uid() = user_id
);

-- 3. 配置 Storage Bucket (project-completions)
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-completions', 'project-completions', true)
ON CONFLICT (id) DO NOTHING;

-- 4. 配置 Storage RLS 策略
-- 允许公开读取
DROP POLICY IF EXISTS "Completion images are publicly accessible" ON storage.objects;
CREATE POLICY "Completion images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-completions');

-- 允许认证用户上传
-- 路径必须以 user_id 开头，确保安全性
DROP POLICY IF EXISTS "Authenticated users can upload completion images" ON storage.objects;
CREATE POLICY "Authenticated users can upload completion images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-completions' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 允许用户修改自己的图片
DROP POLICY IF EXISTS "Users can update their own completion images" ON storage.objects;
CREATE POLICY "Users can update their own completion images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'project-completions'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 允许用户删除自己的图片
DROP POLICY IF EXISTS "Users can delete their own completion images" ON storage.objects;
CREATE POLICY "Users can delete their own completion images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-completions'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DO $$
BEGIN
  RAISE NOTICE '✅ 完成记录表(completed_projects)增强完成';
  RAISE NOTICE '✅ 存储桶(project-completions)配置完成';
END $$;
