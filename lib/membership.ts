export const membershipTiers = ['free', 'pro', 'founder'] as const
export type MembershipTier = (typeof membershipTiers)[number]

export const membershipPeriods = ['none', 'monthly', 'yearly', 'lifetime', 'founder'] as const
export type MembershipPeriod = (typeof membershipPeriods)[number]

export type MembershipProfile = {
  membership_tier?: string | null
  membership_period?: string | null
  membership_started_at?: string | null
  membership_expires_at?: string | null
}

export type MembershipSummary = {
  tier: MembershipTier
  period: MembershipPeriod
  isActive: boolean
  label: string
  quota: number
  startedAt: string | null
  expiresAt: string | null
}

export const FREE_AI_DAILY_QUOTA = 5
export const MEMBER_AI_DAILY_QUOTA = 100

export const membershipPeriodLabels: Record<MembershipPeriod, string> = {
  none: '普通用户',
  monthly: '月度会员',
  yearly: '年度会员',
  lifetime: '终身会员',
  founder: '创始会员',
}

function normalizeTier(value: string | null | undefined): MembershipTier {
  return membershipTiers.includes(value as MembershipTier) ? (value as MembershipTier) : 'free'
}

function normalizePeriod(value: string | null | undefined): MembershipPeriod {
  return membershipPeriods.includes(value as MembershipPeriod) ? (value as MembershipPeriod) : 'none'
}

export function isMembershipActive(profile: MembershipProfile | null | undefined, now = new Date()) {
  if (!profile) return false

  const tier = normalizeTier(profile.membership_tier)
  const period = normalizePeriod(profile.membership_period)

  if (tier === 'founder' && period === 'founder') return true
  if (tier === 'pro' && period === 'lifetime') return true
  if (tier === 'pro' && (period === 'monthly' || period === 'yearly')) {
    if (!profile.membership_expires_at) return false
    return Date.parse(profile.membership_expires_at) > now.getTime()
  }

  return false
}

export function getMembershipSummary(
  profile: MembershipProfile | null | undefined,
  now = new Date(),
): MembershipSummary {
  const tier = normalizeTier(profile?.membership_tier)
  const period = normalizePeriod(profile?.membership_period)
  const isActive = isMembershipActive(profile, now)
  const effectivePeriod = isActive ? period : 'none'

  return {
    tier: isActive ? tier : 'free',
    period: effectivePeriod,
    isActive,
    label: membershipPeriodLabels[effectivePeriod],
    quota: isActive ? MEMBER_AI_DAILY_QUOTA : FREE_AI_DAILY_QUOTA,
    startedAt: profile?.membership_started_at ?? null,
    expiresAt: isActive ? profile?.membership_expires_at ?? null : null,
  }
}
