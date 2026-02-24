ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS equipped_name_color_id text DEFAULT NULL;

COMMENT ON COLUMN public.profiles.equipped_name_color_id IS '当前装备的名字颜色 id';

CREATE OR REPLACE FUNCTION public.get_shop_item_price(p_item_id text)
RETURNS int
LANGUAGE sql
STABLE
AS $$
  SELECT CASE p_item_id
    WHEN 'neon_halo'   THEN 10
    WHEN 'pixel_border' THEN 8
    WHEN 'golden_crown' THEN 20
    WHEN 'cyber_glitch' THEN 15
    WHEN 'crystal_glass' THEN 12
    WHEN 'name_color_neon' THEN 10
    WHEN 'name_color_cherry' THEN 10
    WHEN 'name_color_abyss' THEN 10
    WHEN 'name_color_gold' THEN 20
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_item(p_item_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_price int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  v_price := public.get_shop_item_price(p_item_id);
  IF v_price IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_item');
  END IF;

  UPDATE public.profiles
  SET coins = coins - v_price
  WHERE id = v_user_id
    AND coins >= v_price;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_coins');
  END IF;

  INSERT INTO public.coin_logs (user_id, amount, action_type, resource_id)
  VALUES (v_user_id, -v_price, 'purchase', p_item_id);

  INSERT INTO public.user_inventory (user_id, item_id, unlocked_at)
  VALUES (v_user_id, p_item_id, now())
  ON CONFLICT (user_id, item_id) DO NOTHING;

  IF p_item_id IN ('neon_halo', 'pixel_border', 'golden_crown', 'cyber_glitch', 'crystal_glass') THEN
    UPDATE public.profiles
    SET equipped_avatar_frame_id = p_item_id
    WHERE id = v_user_id;
  ELSIF p_item_id LIKE 'name_color_%' THEN
    UPDATE public.profiles
    SET equipped_name_color_id = p_item_id
    WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'item_id', p_item_id, 'price', v_price);
END;
$$;

CREATE OR REPLACE FUNCTION public.equip_name_color(p_item_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_owned boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF p_item_id IS NULL OR p_item_id = '' THEN
    UPDATE public.profiles
    SET equipped_name_color_id = NULL
    WHERE id = v_user_id;
    RETURN jsonb_build_object('ok', true, 'equipped', null);
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.user_inventory
    WHERE user_id = v_user_id AND item_id = p_item_id
  ) INTO v_owned;

  IF NOT v_owned THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owned');
  END IF;

  IF p_item_id NOT LIKE 'name_color_%' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_name_color');
  END IF;

  UPDATE public.profiles
  SET equipped_name_color_id = p_item_id
  WHERE id = v_user_id;

  RETURN jsonb_build_object('ok', true, 'equipped', p_item_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.equip_name_color(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_name_color(text) TO service_role;
