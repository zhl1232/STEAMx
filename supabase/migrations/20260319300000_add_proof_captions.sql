-- Add proof_captions column to completed_projects
-- Parallel text[] array with proof_images: each entry is a caption for the corresponding image
ALTER TABLE public.completed_projects
  ADD COLUMN IF NOT EXISTS proof_captions text[];
