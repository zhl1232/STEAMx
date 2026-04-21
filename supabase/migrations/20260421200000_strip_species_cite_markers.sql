-- ============================================
-- 清理 species 文案中的引用标记（如 [cite: 885]）
-- ============================================

WITH cleaned AS (
  SELECT
    id,
    NULLIF(
      btrim(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(COALESCE(identification_notes, ''), '\s*\[cite:\s*\d+\]\s*', ' ', 'gi'),
                '\s*cite:\s*\d+\]?\s*',
                ' ',
                'gi'
              ),
              '\s+([，。；：、！？）\)\]】])',
              '\1',
              'g'
            ),
            '([（\(\[【])\s+',
            '\1',
            'g'
          ),
          '\s{2,}',
          ' ',
          'g'
        )
      ),
      ''
    ) AS identification_notes_clean,
    NULLIF(
      btrim(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(COALESCE(habitat_notes, ''), '\s*\[cite:\s*\d+\]\s*', ' ', 'gi'),
                '\s*cite:\s*\d+\]?\s*',
                ' ',
                'gi'
              ),
              '\s+([，。；：、！？）\)\]】])',
              '\1',
              'g'
            ),
            '([（\(\[【])\s+',
            '\1',
            'g'
          ),
          '\s{2,}',
          ' ',
          'g'
        )
      ),
      ''
    ) AS habitat_notes_clean,
    NULLIF(
      btrim(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(COALESCE(seasonality_notes, ''), '\s*\[cite:\s*\d+\]\s*', ' ', 'gi'),
                '\s*cite:\s*\d+\]?\s*',
                ' ',
                'gi'
              ),
              '\s+([，。；：、！？）\)\]】])',
              '\1',
              'g'
            ),
            '([（\(\[【])\s+',
            '\1',
            'g'
          ),
          '\s{2,}',
          ' ',
          'g'
        )
      ),
      ''
    ) AS seasonality_notes_clean
  FROM public.species
)
UPDATE public.species AS s
SET
  identification_notes = cleaned.identification_notes_clean,
  habitat_notes = cleaned.habitat_notes_clean,
  seasonality_notes = cleaned.seasonality_notes_clean,
  updated_at = now()
FROM cleaned
WHERE s.id = cleaned.id;
