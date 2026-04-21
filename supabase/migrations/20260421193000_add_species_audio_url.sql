-- ============================================
-- 为 species 增加音频字段
-- ============================================

ALTER TABLE public.species
ADD COLUMN IF NOT EXISTS audio_url TEXT;

COMMENT ON COLUMN public.species.audio_url IS '物种音频（鸟鸣）URL，优先使用站内 /birds/audio/* 路径';
