-- Batch replace .png → .webp in all project image_url references
-- This covers both /projects/generated/project-XXXX.png and /projects/category_name.png patterns

UPDATE public.projects
SET image_url = regexp_replace(image_url, '\.png$', '.webp')
WHERE image_url LIKE '%.png';
