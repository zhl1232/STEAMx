-- Restore fruit cover images from the curated fruits manifest.
-- The previous align migration cleared covers for species awaiting upload;
-- those images are now available locally and in public/manifests/fruits.json.

WITH manifest_fruit_covers(slug, cover_image_url) AS (
  VALUES
    ('actinidia-arguta', '/fruits/images/actinidia-arguta-1.jpg'),
    ('annona-spp', '/fruits/images/annona-spp-1.jpg'),
    ('arachis-hypogaea', '/fruits/images/arachis-hypogaea-1.jpg'),
    ('armeniaca-mume', '/fruits/images/armeniaca-mume-1.jpg'),
    ('armeniaca-vulgaris', '/fruits/images/armeniaca-vulgaris-1.jpg'),
    ('canarium-album', '/fruits/images/canarium-album-1.jpg'),
    ('carya-illinoinensis', '/fruits/images/carya-illinoinensis-1.jpg'),
    ('cerasus-avium', '/fruits/images/cerasus-avium-1.jpg'),
    ('citrullus-lanatus', '/fruits/images/citrullus-lanatus-1.jpg'),
    ('citrus-ehime-28', '/fruits/images/citrus-ehime-28-1.jpg'),
    ('citrus-harumi-shiranui', '/fruits/images/citrus-harumi-shiranui-1.jpg'),
    ('citrus-limon', '/fruits/images/citrus-limon-1.jpg'),
    ('citrus-maxima', '/fruits/images/citrus-maxima-1.jpg'),
    ('citrus-reticulata', '/fruits/images/citrus-reticulata-1.jpg'),
    ('clausena-lansium', '/fruits/images/clausena-lansium-1.jpg'),
    ('cocos-nucifera', '/fruits/images/cocos-nucifera-1.jpg'),
    ('ficus-carica', '/fruits/images/ficus-carica-1.jpg'),
    ('fragaria-ananassa', '/fruits/images/fragaria-ananassa-1.jpg'),
    ('helianthus-annuus', '/fruits/images/helianthus-annuus-1.jpg'),
    ('juglans-regia', '/fruits/images/juglans-regia-1.jpg'),
    ('lycium-barbarum', '/fruits/images/lycium-barbarum-1.jpg'),
    ('lycopersicon-esculentum', '/fruits/images/lycopersicon-esculentum-1.jpg'),
    ('macadamia-spp', '/fruits/images/macadamia-spp-1.jpg'),
    ('malus-micromalus', '/fruits/images/malus-micromalus-1.jpg'),
    ('malus-pumila', '/fruits/images/malus-pumila-1.jpg'),
    ('passiflora-edulis', '/fruits/images/passiflora-edulis-1.jpg'),
    ('persea-americana', '/fruits/images/persea-americana-1.jpg'),
    ('phoenix-dactylifera', '/fruits/images/phoenix-dactylifera-1.jpg'),
    ('physalis-peruviana', '/fruits/images/physalis-peruviana-1.jpg'),
    ('pinus-koraiensis', '/fruits/images/pinus-koraiensis-1.jpg'),
    ('pyrus-bretschneideri', '/fruits/images/pyrus-bretschneideri-1.jpg'),
    ('pyrus-communis', '/fruits/images/pyrus-communis-1.jpg'),
    ('pyrus-ussuriensis', '/fruits/images/pyrus-ussuriensis-1.jpg'),
    ('ribes-spp', '/fruits/images/ribes-spp-1.jpg'),
    ('rubus-spp', '/fruits/images/rubus-spp-1.jpg'),
    ('saccharum-officinarum', '/fruits/images/saccharum-officinarum-1.jpg'),
    ('siraitia-grosvenorii', '/fruits/images/siraitia-grosvenorii-1.jpg'),
    ('syzygium-samarangense', '/fruits/images/syzygium-samarangense-1.jpg'),
    ('tamarindus-indica', '/fruits/images/tamarindus-indica-1.jpg'),
    ('vaccinium-spp', '/fruits/images/vaccinium-spp-1.jpg'),
    ('vaccinium-spp-cranberry', '/fruits/images/vaccinium-spp-cranberry-1.jpg')
)
UPDATE public.species AS target
   SET cover_image_url = curated.cover_image_url,
       updated_at = now()
  FROM manifest_fruit_covers AS curated
 WHERE target.slug = curated.slug
   AND target.nature_topic = 'plants'
   AND target.plant_uses && ARRAY['fruit', 'nut', 'vegetable', 'edible']::TEXT[]
   AND target.cover_image_url IS DISTINCT FROM curated.cover_image_url;
