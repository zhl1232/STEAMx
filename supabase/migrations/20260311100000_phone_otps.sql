-- 自定义短信验证码表（用于替代 Supabase 官方短信，对接自有或第三方短信接口）
-- 验证码用于：登录/注册（type=login）、绑定/换绑手机（type=phone_change）

CREATE TABLE IF NOT EXISTS public.phone_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  type text NOT NULL DEFAULT 'login' CHECK (type IN ('login', 'phone_change')),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_otps_phone_expires
  ON public.phone_otps (phone, expires_at);

ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;

-- 仅服务端（service_role）可读写，前端不可见
CREATE POLICY "phone_otps_service_only"
  ON public.phone_otps
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.phone_otps IS '自定义短信 OTP，用于登录/注册或绑定手机，对接自有短信接口';

-- 手机号 -> 用户 ID 映射（自定义短信注册的用户用占位邮箱，通过此表按手机号查用户）
CREATE TABLE IF NOT EXISTS public.phone_to_user (
  phone text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.phone_to_user ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phone_to_user_service_only"
  ON public.phone_to_user FOR ALL USING (false) WITH CHECK (false);
COMMENT ON TABLE public.phone_to_user IS '手机号与 auth 用户映射，供自定义短信登录时按手机号查找用户';
