-- Sync get_shop_item_price with frontend lib/shop/items.ts prices

CREATE OR REPLACE FUNCTION public.get_shop_item_price(p_item_id text)
RETURNS int
LANGUAGE sql
STABLE
AS $$
  SELECT CASE p_item_id
    WHEN 'pixel_border'      THEN 15
    WHEN 'crystal_glass'     THEN 50
    WHEN 'neon_halo'         THEN 150
    WHEN 'cyber_glitch'      THEN 300
    WHEN 'golden_crown'      THEN 800
    WHEN 'name_color_cherry' THEN 15
    WHEN 'name_color_abyss'  THEN 50
    WHEN 'name_color_neon'   THEN 150
    WHEN 'name_color_gold'   THEN 500
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.get_shop_item_price(text) IS 'Returns the coin price for a shop item, synced with frontend lib/shop/items.ts';
