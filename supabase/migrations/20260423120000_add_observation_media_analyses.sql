-- ============================================
-- 观察图片 AI 识别结果
-- 仅用于自然观察上传链路
-- ============================================

CREATE TABLE IF NOT EXISTS public.observation_media_analyses (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    model_name TEXT,
    moderation_pass BOOLEAN,
    moderation_reason TEXT,
    quality_pass BOOLEAN,
    quality_reason TEXT,
    species_candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT observation_media_analyses_status_check CHECK (
        status IN ('pending', 'passed', 'failed_unsafe', 'failed_low_quality', 'failed_unrecognized', 'error')
    ),
    CONSTRAINT observation_media_analyses_unique_user_image UNIQUE (user_id, image_url)
);

CREATE INDEX IF NOT EXISTS idx_observation_media_analyses_user_status
    ON public.observation_media_analyses (user_id, status);

CREATE INDEX IF NOT EXISTS idx_observation_media_analyses_updated_at
    ON public.observation_media_analyses (updated_at DESC);

ALTER TABLE public.observation_media_analyses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'observation_media_analyses'
           AND policyname = 'observation_media_analyses_owner_select'
    ) THEN
        CREATE POLICY observation_media_analyses_owner_select
            ON public.observation_media_analyses
            FOR SELECT
            USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'observation_media_analyses'
           AND policyname = 'observation_media_analyses_owner_insert'
    ) THEN
        CREATE POLICY observation_media_analyses_owner_insert
            ON public.observation_media_analyses
            FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'observation_media_analyses'
           AND policyname = 'observation_media_analyses_owner_update'
    ) THEN
        CREATE POLICY observation_media_analyses_owner_update
            ON public.observation_media_analyses
            FOR UPDATE
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
