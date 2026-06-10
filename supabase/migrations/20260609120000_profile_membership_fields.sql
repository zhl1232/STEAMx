-- Add manually managed membership fields for AI Agent access.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS membership_tier text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS membership_period text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS membership_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS membership_expires_at timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_membership_tier_check,
  ADD CONSTRAINT profiles_membership_tier_check
    CHECK (membership_tier IN ('free', 'pro', 'founder'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_membership_period_check,
  ADD CONSTRAINT profiles_membership_period_check
    CHECK (membership_period IN ('none', 'monthly', 'yearly', 'lifetime', 'founder'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_membership_shape_check,
  ADD CONSTRAINT profiles_membership_shape_check
    CHECK (
      (
        membership_tier = 'free'
        AND membership_period = 'none'
        AND membership_started_at IS NULL
        AND membership_expires_at IS NULL
      )
      OR (
        membership_tier = 'pro'
        AND membership_period IN ('monthly', 'yearly')
        AND membership_started_at IS NOT NULL
        AND membership_expires_at IS NOT NULL
      )
      OR (
        membership_tier = 'pro'
        AND membership_period = 'lifetime'
        AND membership_started_at IS NOT NULL
        AND membership_expires_at IS NULL
      )
      OR (
        membership_tier = 'founder'
        AND membership_period = 'founder'
        AND membership_started_at IS NOT NULL
        AND membership_expires_at IS NULL
      )
    );

CREATE INDEX IF NOT EXISTS idx_profiles_membership_tier
  ON public.profiles (membership_tier);

CREATE INDEX IF NOT EXISTS idx_profiles_membership_expires_at
  ON public.profiles (membership_expires_at)
  WHERE membership_expires_at IS NOT NULL;

COMMENT ON COLUMN public.profiles.membership_tier IS 'Current membership entitlement tier: free, pro, founder.';
COMMENT ON COLUMN public.profiles.membership_period IS 'Current membership period type: none, monthly, yearly, lifetime, founder.';
COMMENT ON COLUMN public.profiles.membership_started_at IS 'Current membership period start time, set manually by admins in v1.';
COMMENT ON COLUMN public.profiles.membership_expires_at IS 'Membership expiry for monthly/yearly plans; null for free, lifetime, and founder.';
