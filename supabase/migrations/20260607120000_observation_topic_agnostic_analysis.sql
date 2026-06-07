-- Make observation media analyses topic-agnostic.
-- One AI analysis per (user, image), independent of nature_topic.
-- Also extend the observation_events nature_topic CHECK to include insects + fungi.

-- 1. observation_media_analyses: drop topic from unique key, allow null on nature_topic.
ALTER TABLE public.observation_media_analyses
  DROP CONSTRAINT IF EXISTS observation_media_analyses_unique_user_image_topic,
  DROP CONSTRAINT IF EXISTS observation_media_analyses_unique_user_image;

-- Deduplicate before re-adding the (user_id, image_url) unique constraint.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, image_url
      ORDER BY
        CASE status
          WHEN 'passed' THEN 0
          WHEN 'passed_no_identification' THEN 1
          WHEN 'pending' THEN 2
          WHEN 'error' THEN 3
          ELSE 4
        END,
        updated_at DESC,
        id DESC
    ) AS row_num
  FROM public.observation_media_analyses
)
DELETE FROM public.observation_media_analyses
WHERE id IN (SELECT id FROM ranked WHERE row_num > 1);

ALTER TABLE public.observation_media_analyses
  ALTER COLUMN nature_topic DROP NOT NULL,
  ALTER COLUMN nature_topic DROP DEFAULT;

ALTER TABLE public.observation_media_analyses
  DROP CONSTRAINT IF EXISTS observation_media_analyses_nature_topic_check,
  ADD CONSTRAINT observation_media_analyses_nature_topic_check
    CHECK (nature_topic IS NULL OR nature_topic IN ('birds', 'insects', 'plants', 'fungi')),
  ADD CONSTRAINT observation_media_analyses_unique_user_image
    UNIQUE (user_id, image_url);

-- 2. observation_events: include insects + fungi in the topic check.
ALTER TABLE public.observation_events
  DROP CONSTRAINT IF EXISTS observation_events_nature_topic_check,
  ADD CONSTRAINT observation_events_nature_topic_check
    CHECK (nature_topic IS NULL OR nature_topic IN ('birds', 'insects', 'plants', 'fungi'));
