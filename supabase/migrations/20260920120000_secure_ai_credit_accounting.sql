-- Secure AI credit accounting.  The legacy mutation RPCs remain for schema
-- compatibility but are no longer callable by client roles.

-- Receipt lookups must not scan a user's complete refund history.
CREATE INDEX IF NOT EXISTS idx_ai_credit_refunds_receipt
ON public.ai_credit_logs (user_id, (meta->>'receiptId'))
WHERE reason = 'refund';

CREATE OR REPLACE FUNCTION public.count_ai_free_chats_today(p_user_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.ai_credit_logs debit
  WHERE debit.user_id = p_user_id
    AND debit.reason = 'free_chat'
    AND debit.created_at >= public.ai_credit_day_start()
    AND COALESCE((
      SELECT SUM((refund.meta->>'refundCost')::int)
      FROM public.ai_credit_logs refund
      WHERE refund.user_id = debit.user_id
        AND refund.reason = 'refund'
        AND refund.meta->>'receiptId' = debit.id::text
    ), 0) < abs(debit.amount);
$$;

CREATE OR REPLACE FUNCTION public.get_ai_credit_status(
  p_is_member boolean,
  p_monthly_grant int,
  p_free_daily int
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_wallet public.ai_credit_wallets%ROWTYPE;
  v_period text := public.ai_credit_month_period();
  v_is_member boolean;
  v_monthly_grant int := 1500;
  v_free_daily int := 5;
  v_free_used int;
  v_free_remaining int;
  v_wallet_balance int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  v_is_member := COALESCE((
    (v_profile.membership_tier = 'founder' AND v_profile.membership_period = 'founder')
    OR (v_profile.membership_tier = 'pro' AND v_profile.membership_period = 'lifetime')
    OR (
      v_profile.membership_tier = 'pro'
      AND v_profile.membership_period IN ('monthly', 'yearly')
      AND v_profile.membership_expires_at > now()
    )
  ), false);
  SELECT * INTO v_wallet FROM public.ai_credit_wallets WHERE user_id = v_user_id;
  v_free_used := public.count_ai_free_chats_today(v_user_id);
  v_free_remaining := GREATEST(v_free_daily - v_free_used, 0);

  IF v_is_member THEN
    IF v_wallet.user_id IS NULL OR v_wallet.grant_period IS DISTINCT FROM v_period THEN
      v_wallet_balance := v_monthly_grant;
    ELSE
      v_wallet_balance := v_wallet.balance;
    END IF;
  ELSE
    v_wallet_balance := 0;
  END IF;

  RETURN jsonb_build_object(
    'isMember', v_is_member,
    'walletBalance', v_wallet_balance,
    'monthlyGrant', v_monthly_grant,
    'freeDaily', v_free_daily,
    'freeUsedToday', v_free_used,
    'freeRemainingToday', v_free_remaining,
    'grantPeriod', v_period,
    'dayResetAt', EXTRACT(EPOCH FROM (public.ai_credit_day_start() + interval '1 day'))::bigint,
    'canChat', (v_wallet_balance >= 1 OR v_free_remaining >= 1)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_ai_credit_service(
  p_user_id uuid,
  p_cost int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period text := public.ai_credit_month_period();
  v_wallet public.ai_credit_wallets%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_is_member boolean;
  v_free_used int;
  v_new_balance int;
  v_receipt_id bigint;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_user');
  END IF;
  IF p_cost IS NULL OR p_cost < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_cost');
  END IF;

  -- Serialize wallet creation/renewal and free quota checks for this user.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;
  v_is_member := COALESCE((
    (v_profile.membership_tier = 'founder' AND v_profile.membership_period = 'founder')
    OR (v_profile.membership_tier = 'pro' AND v_profile.membership_period = 'lifetime')
    OR (
      v_profile.membership_tier = 'pro'
      AND v_profile.membership_period IN ('monthly', 'yearly')
      AND v_profile.membership_expires_at > now()
    )
  ), false);

  IF v_is_member THEN
    SELECT * INTO v_wallet FROM public.ai_credit_wallets WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO public.ai_credit_wallets (user_id, balance, grant_period)
      VALUES (p_user_id, 1500, v_period)
      RETURNING * INTO v_wallet;
      INSERT INTO public.ai_credit_logs (user_id, amount, reason, meta)
      VALUES (p_user_id, 1500, 'monthly_grant', jsonb_build_object('period', v_period));
    ELSIF v_wallet.grant_period IS DISTINCT FROM v_period THEN
      UPDATE public.ai_credit_wallets
      SET balance = 1500, grant_period = v_period, updated_at = now()
      WHERE user_id = p_user_id
      RETURNING * INTO v_wallet;
      INSERT INTO public.ai_credit_logs (user_id, amount, reason, meta)
      VALUES (p_user_id, 1500, 'monthly_grant', jsonb_build_object('period', v_period));
    END IF;

    IF v_wallet.balance >= p_cost THEN
      v_new_balance := v_wallet.balance - p_cost;
      UPDATE public.ai_credit_wallets SET balance = v_new_balance, updated_at = now()
      WHERE user_id = p_user_id;
      INSERT INTO public.ai_credit_logs (user_id, amount, reason, meta)
      VALUES (p_user_id, -p_cost, 'credit_chat', jsonb_build_object('cost', p_cost))
      RETURNING id INTO v_receipt_id;
      UPDATE public.ai_credit_logs SET meta = meta || jsonb_build_object('receiptId', v_receipt_id)
      WHERE id = v_receipt_id;
      RETURN jsonb_build_object('ok', true, 'source', 'wallet', 'remaining', v_new_balance,
        'cost', p_cost, 'receiptId', v_receipt_id);
    END IF;
  END IF;

  v_free_used := public.count_ai_free_chats_today(p_user_id);
  IF v_free_used >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'quota_exceeded', 'source', 'free',
      'remaining', 0, 'freeUsedToday', v_free_used, 'freeDaily', 5,
      'resetAt', EXTRACT(EPOCH FROM (public.ai_credit_day_start() + interval '1 day'))::bigint);
  END IF;

  INSERT INTO public.ai_credit_logs (user_id, amount, reason, meta)
  VALUES (p_user_id, -p_cost, 'free_chat', jsonb_build_object('cost', p_cost))
  RETURNING id INTO v_receipt_id;
  UPDATE public.ai_credit_logs SET meta = meta || jsonb_build_object('receiptId', v_receipt_id)
  WHERE id = v_receipt_id;
  RETURN jsonb_build_object('ok', true, 'source', 'free',
    'remaining', GREATEST(5 - v_free_used - 1, 0), 'cost', p_cost,
    'freeUsedToday', v_free_used + 1, 'freeDaily', 5,
    'resetAt', EXTRACT(EPOCH FROM (public.ai_credit_day_start() + interval '1 day'))::bigint,
    'receiptId', v_receipt_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_ai_credit_service(
  p_user_id uuid,
  p_refund_cost int,
  p_source text,
  p_receipt_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt public.ai_credit_logs%ROWTYPE;
  v_refunded int;
  v_refund int;
BEGIN
  IF p_user_id IS NULL OR p_receipt_id IS NULL OR p_refund_cost IS NULL OR p_refund_cost < 1
     OR p_source IS NULL OR p_source NOT IN ('wallet', 'free') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_params');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  SELECT * INTO v_receipt FROM public.ai_credit_logs
  WHERE id = p_receipt_id AND user_id = p_user_id
    AND reason IN ('credit_chat', 'free_chat') AND amount < 0
  FOR UPDATE;
  IF NOT FOUND OR v_receipt.reason <> (CASE WHEN p_source = 'wallet' THEN 'credit_chat' ELSE 'free_chat' END) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_receipt');
  END IF;
  v_refunded := COALESCE((SELECT SUM((meta->>'refundCost')::int) FROM public.ai_credit_logs
    WHERE user_id = p_user_id AND reason = 'refund' AND meta->>'receiptId' = p_receipt_id::text), 0);
  -- p_refund_cost is the cumulative refund target for this receipt.
  v_refund := GREATEST(LEAST(p_refund_cost, abs(v_receipt.amount)) - v_refunded, 0);
  IF v_refund <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'refunded', 0, 'receiptId', p_receipt_id);
  END IF;
  IF p_source = 'wallet' THEN
    UPDATE public.ai_credit_wallets SET balance = balance + v_refund, updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
  INSERT INTO public.ai_credit_logs (user_id, amount, reason, meta)
  VALUES (p_user_id, v_refund, 'refund', jsonb_build_object(
    'source', p_source, 'refundCost', v_refund, 'receiptId', p_receipt_id));
  RETURN jsonb_build_object('ok', true, 'refunded', v_refund, 'receiptId', p_receipt_id);
END;
$$;

-- Keep administrative adjustments serialized with consumption/refunds.
CREATE OR REPLACE FUNCTION public.admin_adjust_ai_credit(
  p_target_user_id uuid,
  p_amount int,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_role text;
  v_new_balance int;
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_admin_id;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF p_target_user_id IS NULL OR p_amount IS NULL OR p_amount = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_params');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_target_user_id::text, 0));
  INSERT INTO public.ai_credit_wallets (user_id, balance)
  VALUES (p_target_user_id, GREATEST(p_amount, 0))
  ON CONFLICT (user_id) DO UPDATE
    SET balance = GREATEST(public.ai_credit_wallets.balance + p_amount, 0),
        updated_at = now()
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.ai_credit_logs (user_id, amount, reason, meta)
  VALUES (p_target_user_id, p_amount, 'admin_adjust',
    jsonb_build_object('note', p_note, 'adminId', v_admin_id));
  RETURN jsonb_build_object('ok', true, 'balance', v_new_balance);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_ai_credit(int, boolean, int, int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_ai_credit(int, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.count_ai_free_chats_today(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_ai_credit_service(uuid, int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_ai_credit_service(uuid, int, text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_credit_service(uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_ai_credit_service(uuid, int, text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_ai_credit_status(boolean, int, int) TO authenticated;
