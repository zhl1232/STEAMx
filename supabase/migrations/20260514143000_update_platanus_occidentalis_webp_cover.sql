UPDATE public.species
SET cover_image_url = '/trees/images/platanus-occidentalis-1.webp',
    updated_at = now()
WHERE slug = 'platanus-occidentalis'
  AND (
    cover_image_url IS NULL
    OR cover_image_url = '/trees/images/platanus-occidentalis-1.jpg'
  );
