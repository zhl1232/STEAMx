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

/** 每个账号每日赠送的 AI 代币；北京时间当日有效，不累计。 */
export const FREE_AI_DAILY_CREDITS = 300
/** 小迪使用日赠代币时，单轮最多扣减的代币。 */
export const FREE_AI_PER_REQUEST_CREDIT_CAP = 100
/** @deprecated 仅供历史按次凭证兼容；当前权益使用 FREE_AI_DAILY_CREDITS。 */
export const FREE_AI_DAILY_QUOTA = 5
/** @deprecated 仅供历史引用兼容；当前权益统一使用代币。 */
export const MEMBER_AI_DAILY_QUOTA = 100

/** 普通会员每自然月发放的 AI 代币。 */
export const MEMBER_AI_MONTHLY_CREDITS = 15_000
/** 创始会员每自然月发放的 AI 代币。 */
export const FOUNDER_AI_MONTHLY_CREDITS = 20_000
/** 纯文本对话消耗代币 */
export const AI_CREDIT_COST_TEXT = 1
/** 带图片对话消耗代币 */
export const AI_CREDIT_COST_VISION = 2
/** AI 导师 API 分钟级限流（每用户） */
export const AI_TUTOR_RATE_LIMIT_PER_MINUTE = 5

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
    quota: isActive
      ? tier === 'founder' ? FOUNDER_AI_MONTHLY_CREDITS : MEMBER_AI_MONTHLY_CREDITS
      : FREE_AI_DAILY_CREDITS,
    startedAt: profile?.membership_started_at ?? null,
    expiresAt: isActive ? profile?.membership_expires_at ?? null : null,
  }
}

export function getAiChatCreditCost(hasImages: boolean) {
  return hasImages ? AI_CREDIT_COST_VISION : AI_CREDIT_COST_TEXT
}
