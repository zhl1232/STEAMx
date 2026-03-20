-- Atomic XP increment to prevent read-modify-write race conditions
CREATE OR REPLACE FUNCTION public.increment_user_xp(p_user_id uuid, p_amount int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'p_amount must be positive, got %', p_amount;
  END IF;

  UPDATE public.profiles
  SET xp = COALESCE(xp, 0) + p_amount
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_user_xp(uuid, int) TO service_role;

COMMENT ON FUNCTION public.increment_user_xp(uuid, int) IS '原子增加用户 XP，避免并发审批时的 read-modify-write 竞态';

-- Unique constraint to prevent duplicate XP awards (TOCTOU defense)
CREATE UNIQUE INDEX IF NOT EXISTS idx_xp_logs_unique_action
ON public.xp_logs(user_id, action_type, resource_id);
