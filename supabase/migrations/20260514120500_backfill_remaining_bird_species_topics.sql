-- ============================================
-- 补齐未命中关键词的鸟类物种分类
-- ============================================

UPDATE public.species
   SET nature_topic = 'birds',
       updated_at = now()
 WHERE slug IN (
   'terpsiphone-incei',
   'garrulax-davidi',
   'upupa-epops',
   'cinclus-pallasii',
   'dicrurus-macrocercus',
   'sitta-villosa',
   'oriolus-chinensis'
 );
