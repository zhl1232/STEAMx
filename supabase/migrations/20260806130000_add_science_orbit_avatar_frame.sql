-- Add the science-themed orbit avatar frame to the shop catalog.

CREATE OR REPLACE FUNCTION public.get_shop_item_price(p_item_id text)
RETURNS int
LANGUAGE sql
STABLE
AS $$
  SELECT CASE p_item_id
    WHEN 'pixel_border'      THEN 15
    WHEN 'crystal_glass'     THEN 50
    WHEN 'science_orbit'     THEN 120
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

CREATE OR REPLACE FUNCTION public.get_shop_item_min_level(p_item_id text)
RETURNS int
LANGUAGE sql
STABLE
AS $$
  SELECT CASE p_item_id
    WHEN 'pixel_border' THEN 0
    WHEN 'crystal_glass' THEN 5
    WHEN 'science_orbit' THEN 8
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
  v_user_coins int;
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

  SELECT coins, level
  INTO v_user_coins, v_user_level
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
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

  IF EXISTS (
    SELECT 1
    FROM public.user_inventory
    WHERE user_id = v_user_id
      AND item_id = p_item_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_owned');
  END IF;

  IF v_user_level >= 30 THEN
    v_price := GREATEST(1, (v_price * 8) / 10);
  END IF;

  IF v_user_coins < v_price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_coins');
  END IF;

  UPDATE public.profiles
  SET coins = v_user_coins - v_price
  WHERE id = v_user_id;

  INSERT INTO public.coin_logs (user_id, amount, action_type, resource_id)
  VALUES (v_user_id, -v_price, 'purchase', p_item_id);

  INSERT INTO public.user_inventory (user_id, item_id, unlocked_at)
  VALUES (v_user_id, p_item_id, now());

  IF p_item_id IN ('neon_halo', 'pixel_border', 'golden_crown', 'cyber_glitch', 'crystal_glass', 'science_orbit') THEN
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

CREATE OR REPLACE FUNCTION public.equip_avatar_frame(p_item_id text)
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
    SET equipped_avatar_frame_id = NULL
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

  IF p_item_id NOT IN ('neon_halo', 'pixel_border', 'golden_crown', 'cyber_glitch', 'crystal_glass', 'science_orbit') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_avatar_frame');
  END IF;

  UPDATE public.profiles
  SET equipped_avatar_frame_id = p_item_id
  WHERE id = v_user_id;

  RETURN jsonb_build_object('ok', true, 'equipped', p_item_id);
END;
$$;
