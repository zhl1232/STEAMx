-- Add shop item min level lookup and enforce it in purchase_item

CREATE OR REPLACE FUNCTION public.get_shop_item_min_level(p_item_id text)
RETURNS int
LANGUAGE sql
STABLE
AS $$
  SELECT CASE p_item_id
    WHEN 'pixel_border' THEN 0
    WHEN 'crystal_glass' THEN 5
    WHEN 'neon_halo' THEN 10
    WHEN 'cyber_glitch' THEN 20
    WHEN 'golden_crown' THEN 30
    WHEN 'name_color_cherry' THEN 0
    WHEN 'name_color_abyss' THEN 5
    WHEN 'name_color_neon' THEN 10
    WHEN 'name_color_gold' THEN 20
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.get_shop_item_min_level(text) IS 'Returns minimum level required for a shop item (0 means no requirement).';

CREATE OR REPLACE FUNCTION public.purchase_item(p_item_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_price int;
  v_min_level int;
  v_user_level int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  v_price := public.get_shop_item_price(p_item_id);
  IF v_price IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_item');
  END IF;

  v_min_level := public.get_shop_item_min_level(p_item_id);
  IF v_min_level IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_item');
  END IF;

  IF v_min_level > 0 THEN
    SELECT level INTO v_user_level
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_user_level IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found');
    END IF;

    IF v_user_level < v_min_level THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'min_level_required',
        'min_level', v_min_level,
        'level', v_user_level
      );
    END IF;
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
