-- Store AI-generated observation note suggestions alongside media analysis results.

ALTER TABLE public.observation_media_analyses
  ADD COLUMN IF NOT EXISTS note_suggestion TEXT;

COMMENT ON COLUMN public.observation_media_analyses.note_suggestion
  IS 'AI-generated editable observation note suggestion based on the uploaded image.';

NOTIFY pgrst, 'reload schema';
