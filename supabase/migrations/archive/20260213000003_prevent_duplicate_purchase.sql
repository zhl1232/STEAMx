-- 禁止重复购买：头像框等永久物品已拥有时不再扣币，直接返回 already_owned
CREATE OR REPLACE FUNCTION public.purchase_item(p_item_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_price int;
  v_already_owned boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  v_price := public.get_shop_item_price(p_item_id);
  IF v_price IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_item');
  END IF;

  -- 已拥有则不可重复购买（不扣币、不记流水）
  SELECT EXISTS(
    SELECT 1 FROM public.user_inventory
    WHERE user_id = v_user_id AND item_id = p_item_id
  ) INTO v_already_owned;
  IF v_already_owned THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_owned');
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
  VALUES (v_user_id, p_item_id, now());

  UPDATE public.profiles
  SET equipped_avatar_frame_id = p_item_id
  WHERE id = v_user_id
    AND p_item_id IN ('neon_halo', 'pixel_border');

  RETURN jsonb_build_object('ok', true, 'item_id', p_item_id, 'price', v_price);
END;
$$;

COMMENT ON FUNCTION public.purchase_item(text) IS '兑换商品：已拥有时返回 already_owned 且不扣币；成功后自动装备该头像框';
