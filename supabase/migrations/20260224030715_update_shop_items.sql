-- 增加新的商店物品：黄金王冠、赛博故障、深海琉璃

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

  UPDATE public.profiles
  SET equipped_avatar_frame_id = p_item_id
  WHERE id = v_user_id
    AND p_item_id IN ('neon_halo', 'pixel_border', 'golden_crown', 'cyber_glitch', 'crystal_glass');

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

  IF p_item_id NOT IN ('neon_halo', 'pixel_border', 'golden_crown', 'cyber_glitch', 'crystal_glass') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_avatar_frame');
  END IF;

  UPDATE public.profiles
  SET equipped_avatar_frame_id = p_item_id
  WHERE id = v_user_id;

  RETURN jsonb_build_object('ok', true, 'equipped', p_item_id);
END;
$$;

-- 注意：在已有数据库中重新授权可能是安全的，但为了完整起见
GRANT EXECUTE ON FUNCTION public.get_shop_item_price(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shop_item_price(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.purchase_item(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_item(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.equip_avatar_frame(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_avatar_frame(text) TO service_role;
