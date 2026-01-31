-- Ensure project-images bucket is public and exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-images', 'project-images', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Drop potential duplicate/stale policies
DROP POLICY IF EXISTS "Project images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Project images are publicly accessible." ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload project images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload project images." ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own project images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own project images" ON storage.objects;

-- 1. Public Read Access
CREATE POLICY "Project images are publicly accessible"
ON storage.objects FOR SELECT
USING ( bucket_id = 'project-images' );

-- 2. Authenticated Upload Access
CREATE POLICY "Anyone can upload project images"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'project-images' AND auth.role() = 'authenticated' );

-- 3. Owner Update Access
CREATE POLICY "Users can update their own project images"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'project-images' AND auth.uid() = owner )
WITH CHECK ( bucket_id = 'project-images' AND auth.uid() = owner );

-- 4. Owner Delete Access
CREATE POLICY "Users can delete their own project images"
ON storage.objects FOR DELETE
USING ( bucket_id = 'project-images' AND auth.uid() = owner );
