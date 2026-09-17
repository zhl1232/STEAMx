-- Add optional project demo video URL and backfill 启蒙版 imports from description text.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS video_url text;

COMMENT ON COLUMN public.projects.video_url IS
  'Optional HTTPS demo video for the project detail player (e.g. CDN mp4).';

-- Prefer the first HTTPS mp4 found in description for tagged 启蒙版 rows.
UPDATE public.projects AS p
SET video_url = m.video_url
FROM (
  SELECT
    id,
    (regexp_match(description, 'https?://[^[:space:]）\]]+\.mp4', 'i'))[1] AS video_url
  FROM public.projects
  WHERE video_url IS NULL
    AND description IS NOT NULL
    AND tags IS NOT NULL
    AND tags @> ARRAY['启蒙版']::text[]
) AS m
WHERE p.id = m.id
  AND m.video_url IS NOT NULL
  AND p.video_url IS NULL;

-- Fallback: any remaining project whose description embeds an mp4 demo line.
UPDATE public.projects AS p
SET video_url = m.video_url
FROM (
  SELECT
    id,
    (regexp_match(description, 'https?://[^[:space:]）\]]+\.mp4', 'i'))[1] AS video_url
  FROM public.projects
  WHERE video_url IS NULL
    AND description IS NOT NULL
    AND description ~* '演示视频'
) AS m
WHERE p.id = m.id
  AND m.video_url IS NOT NULL
  AND p.video_url IS NULL;
