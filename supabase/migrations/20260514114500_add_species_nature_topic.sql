-- ============================================
-- 为物种增加显式自然专题分类
-- ============================================

ALTER TABLE public.species
  ADD COLUMN IF NOT EXISTS nature_topic TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'species_nature_topic_check'
       AND conrelid = 'public.species'::regclass
  ) THEN
    ALTER TABLE public.species
      ADD CONSTRAINT species_nature_topic_check
      CHECK (nature_topic IS NULL OR nature_topic IN ('birds', 'insects', 'plants', 'fungi'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_species_nature_topic
  ON public.species (nature_topic)
  WHERE is_active = TRUE;

UPDATE public.species
   SET nature_topic = CASE
     WHEN common_name ~ '(鸟|禽|鹭|鸭|雁|鹅|鹳|鹤|鸥|鸻|鹬|鸠|鸽|鹃|鸮|隼|鹰|鹗|雕|鹫|鹞|鸢|鸨|雉|鹌|鹑|鸬鹚|䴙|秧鸡|水鸡|骨顶|翠鸟|啄木|百灵|燕|鹨|鹡鸰|鹎|伯劳|鸦|椋鸟|雀|莺|鸫|鸲|鹟|鹀|山雀|戴菊|鹪鹩)'
       OR COALESCE(taxon_group, '') ~ '(鸟|禽|鹭|鸭|雁|鹅|鹳|鹤|鸥|鸻|鹬|鸠|鸽|鹃|鸮|隼|鹰|鹗|雕|鹫|鹞|鸢|鸨|雉|鹌|鹑|鸬鹚|䴙|秧鸡|水鸡|骨顶|翠鸟|啄木|百灵|燕|鹨|鹡鸰|鹎|伯劳|鸦|椋鸟|雀|莺|鸫|鸲|鹟|鹀|山雀|戴菊|鹪鹩)'
       THEN 'birds'
     WHEN common_name ~ '(真菌|菌物|蘑菇|菇|木耳|灵芝|马勃|伞菌)'
       OR COALESCE(taxon_group, '') ~ '(真菌|菌物|蘑菇|菇|木耳|灵芝|马勃|伞菌)'
       THEN 'fungi'
     WHEN common_name ~ '(昆虫|虫|蝶|蛾|蜂|蚁|甲虫|瓢虫|蜻蜓|螳螂|蟋蟀|蝉|蝽|蚊|蝇|螽斯|蝗|蚱)'
       OR COALESCE(taxon_group, '') ~ '(昆虫|虫|蝶|蛾|蜂|蚁|甲虫|瓢虫|蜻蜓|螳螂|蟋蟀|蝉|蝽|蚊|蝇|螽斯|蝗|蚱)'
       THEN 'insects'
     WHEN common_name ~ '(植物|花|草|树|灌木|乔木|藤|莲|荷|兰|菊|蔷薇|松|柏|蕨|苔藓|藻)'
       OR COALESCE(taxon_group, '') ~ '(植物|花|草|树|灌木|乔木|藤|莲|荷|兰|菊|蔷薇|松|柏|蕨|苔藓|藻)'
       THEN 'plants'
     ELSE nature_topic
   END
 WHERE nature_topic IS NULL;

UPDATE public.species
   SET nature_topic = 'birds',
       updated_at = now()
 WHERE is_active = TRUE
   AND (
     common_name ~ '(鸟|禽|鹭|鸭|雁|鹅|鹳|鹤|鸥|鸻|鹬|鸠|鸽|鹃|鸮|隼|鹰|鹗|雕|鹫|鹞|鸢|鸨|雉|鹌|鹑|鸬鹚|䴙|秧鸡|水鸡|骨顶|翠鸟|啄木|百灵|燕|鹨|鹡鸰|鹎|伯劳|鸦|椋鸟|雀|莺|鸫|鸲|鹟|鹀|山雀|戴菊|鹪鹩)'
     OR COALESCE(taxon_group, '') ~ '(鸟|禽|鹭|鸭|雁|鹅|鹳|鹤|鸥|鸻|鹬|鸠|鸽|鹃|鸮|隼|鹰|鹗|雕|鹫|鹞|鸢|鸨|雉|鹌|鹑|鸬鹚|䴙|秧鸡|水鸡|骨顶|翠鸟|啄木|百灵|燕|鹨|鹡鸰|鹎|伯劳|鸦|椋鸟|雀|莺|鸫|鸲|鹟|鹀|山雀|戴菊|鹪鹩)'
   );

UPDATE public.species
   SET nature_topic = 'plants',
       updated_at = now()
 WHERE slug IN (
   'liriodendron-chinense', 'liriodendron-sinoamericanum', 'berberis-amurensis', 'berberis-thunbergii-atropurpurea', 'platanus-acerifolia', 'platanus-occidentalis', 'buxus-sinica', 'ribes-burejense', 'ampelopsis-aconitifolia-var-palmiloba', 'ampelopsis-humulifolia', 'parthenocissus-quinquefolia', 'albizia-julibrissin', 'amorpha-fruticosa', 'gleditsia-sinensis', 'robinia-ambigua-idahoensis', 'robinia-pseudoacacia', 'styphnolobium-japonicum', 'styphnolobium-japonicum-pendula', 'armeniaca-sibirica', 'cotoneaster-horizontalis', 'crataegus-pinnatifida', 'crataegus-pinnatifida-var-major', 'eriobotrya-japonica', 'malus-baccata', 'padus-avium', 'physocarpus-opulifolius-luteus', 'prunus-cerasifera-f-atropurpurea', 'prunus-salicina', 'pyrus-betulifolia', 'rubus-crataegifolius', 'sorbus-pohuashanensis', 'elaeagnus-angustifolia', 'rhamnus-parvifolia', 'ziziphus-jujuba', 'ziziphus-jujuba-var-spinosa', 'ulmus-parvifolia', 'ulmus-pumila', 'ulmus-pumila-jinye', 'celtis-bungeana', 'pteroceltis-tatarinowii', 'broussonetia-papyrifera', 'maclura-tricuspidata', 'morus-alba', 'morus-mongolica', 'castanea-mollissima', 'quercus-dentata', 'quercus-mongolica', 'quercus-variabilis', 'juglans-mandshurica', 'juglans-regia', 'pterocarya-stenoptera', 'betula-albosinensis', 'betula-dahurica', 'betula-chinensis', 'betula-platyphylla', 'carpinus-turczaninowii', 'corylus-heterophylla', 'corylus-mandshurica', 'celastrus-orbiculatus', 'euonymus-alatus', 'euonymus-alatus-compactus', 'euonymus-japonicus', 'euonymus-maackii', 'populus-alba', 'populus-canadensis', 'populus-nigra-var-italica', 'populus-tomentosa', 'salix-babylonica', 'cotinus-coggygria-var-cinerea', 'pistacia-chinensis', 'rhus-chinensis', 'rhus-typhina', 'acer-freemanii-autumn-blaze', 'acer-negundo', 'acer-palmatum', 'acer-tataricum-subsp-ginnala', 'acer-truncatum', 'aesculus-chinensis', 'koelreuteria-bipinnata-integrifoliola', 'koelreuteria-paniculata', 'citrus-trifoliata', 'phellodendron-amurense', 'tetradium-danii', 'zanthoxylum-bungeanum', 'ailanthus-altissima', 'toona-sinensis', 'firmiana-simplex', 'ginkgo-biloba', 'platycladus-orientalis', 'pinus-tabuliformis'
 );
