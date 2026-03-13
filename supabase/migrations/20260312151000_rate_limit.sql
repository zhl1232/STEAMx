-- Database-backed per-user rate limiting

CREATE TABLE IF NOT EXISTS public.rate_limits (
  user_id uuid NOT NULL,
  rate_key text NOT NULL,
  bucket_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, rate_key, bucket_start)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.rate_limits IS 'Per-user rate limit buckets keyed by action and window start.';
COMMENT ON COLUMN public.rate_limits.rate_key IS 'Logical action key, e.g. api-tips, api-messages-send.';
COMMENT ON COLUMN public.rate_limits.bucket_start IS 'Window bucket start timestamp.';

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key text,
  p_limit int,
  p_window_seconds int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text := auth.role();
  v_now timestamptz := clock_timestamp();
  v_bucket_start timestamptz;
  v_reset_at timestamptz;
  v_count int;
BEGIN
  IF p_key IS NULL OR btrim(p_key) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_key');
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_params');
  END IF;

  v_bucket_start := to_timestamp(floor(EXTRACT(EPOCH FROM v_now) / p_window_seconds) * p_window_seconds);
  v_reset_at := v_bucket_start + make_interval(secs => p_window_seconds);

  IF v_user_id IS NULL THEN
    IF v_role = 'service_role' THEN
      RETURN jsonb_build_object(
        'ok', true,
        'limit', p_limit,
        'remaining', p_limit,
        'reset_at', EXTRACT(EPOCH FROM v_reset_at)::bigint
      );
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  INSERT INTO public.rate_limits (user_id, rate_key, bucket_start, count)
  VALUES (v_user_id, p_key, v_bucket_start, 1)
  ON CONFLICT (user_id, rate_key, bucket_start) DO UPDATE
    SET count = public.rate_limits.count + 1
    WHERE public.rate_limits.count < p_limit
  RETURNING count INTO v_count;

  IF v_count IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'rate_limited',
      'limit', p_limit,
      'remaining', 0,
      'reset_at', EXTRACT(EPOCH FROM v_reset_at)::bigint
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'limit', p_limit,
    'remaining', GREATEST(p_limit - v_count, 0),
    'reset_at', EXTRACT(EPOCH FROM v_reset_at)::bigint
  );
END;
$$;

COMMENT ON FUNCTION public.consume_rate_limit(text, int, int) IS 'Consume a per-user rate limit bucket for the given key/window. Returns ok=false when limited.';
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, int, int) TO service_role;
