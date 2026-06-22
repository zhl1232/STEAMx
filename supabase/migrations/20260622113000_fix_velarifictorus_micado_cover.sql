UPDATE public.species
SET cover_image_url = '/insects/images/velarifictorus-micado-4.jpg',
    updated_at = now()
WHERE slug = 'velarifictorus-micado'
  AND (
    cover_image_url IS NULL
    OR cover_image_url IN (
      '/insects/images/velarifictorus-micado-1.jpg',
      '/insects/images/velarifictorus-micado-2.jpg',
      '/insects/images/velarifictorus-micado-3.jpg'
    )
  );
