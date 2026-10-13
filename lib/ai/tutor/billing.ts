import type { AiCreditStatus, TutorBilling } from '@/lib/ai/tutor/types'
import { FREE_AI_PER_REQUEST_CREDIT_CAP } from '@/lib/membership'

/** Keep the SQL reservation/settlement tariff in sync when changing these. */
export const TUTOR_TOKENS_PER_CREDIT = 100
export const TUTOR_MAX_OUTPUT_TOKENS = 8192
export const TUTOR_MAX_TOTAL_TOKENS = 131072
/** Hard platform work allowance for a subsidized daily-credit request. */
export const TUTOR_DAILY_MAX_TOTAL_TOKENS = 30_000
export const TUTOR_CREDIT_EXHAUSTED_MESSAGE = '可用代币不足，请明天使用新的赠送代币。'

function validCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

/** Validate the server admission before allowing any upstream model work. */
export function validTutorReservationBudget(value: Record<string, unknown>): boolean {
  if (!validCount(value.maxOutputTokens) || value.maxOutputTokens < 1 || value.maxOutputTokens > TUTOR_MAX_OUTPUT_TOKENS ||
      !validCount(value.maxTotalTokens) || value.maxTotalTokens < 1 || value.maxTotalTokens > TUTOR_MAX_TOTAL_TOKENS) return false
  // Count-funded historical receipts predate all these fields. A partial or
  // unknown policy marker must never masquerade as a legacy reservation.
  if (value.creditUnit == null) return value.creditPolicy == null && value.dailyChargeCap == null
  if (value.creditUnit !== 'credits' || (value.creditPolicy != null && value.creditPolicy !== 'daily_credits_v1') ||
      typeof value.reservedCredits !== 'number' || !Number.isFinite(value.reservedCredits) || value.reservedCredits <= 0) return false
  if (value.source === 'free') {
    // Only this explicit, service-issued daily policy authorizes platform
    // support beyond the user's hold; work still has its own hard upper bound.
    return value.creditPolicy === 'daily_credits_v1' && value.dailyChargeCap === FREE_AI_PER_REQUEST_CREDIT_CAP &&
      value.reservedCredits <= FREE_AI_PER_REQUEST_CREDIT_CAP && value.maxTotalTokens <= TUTOR_DAILY_MAX_TOTAL_TOKENS
  }
  return value.source === 'wallet' && value.dailyChargeCap == null &&
    value.maxTotalTokens <= Math.floor(value.reservedCredits * TUTOR_TOKENS_PER_CREDIT + 1e-8)
}

export function formatTutorCredits(value: number): string {
  return Number.isFinite(value) ? Number(value.toFixed(3)).toLocaleString('zh-CN', { maximumFractionDigits: 3 }) : '0'
}

export function formatTutorQuota(quota: AiCreditStatus | null): string | null {
  if (!quota || quota.creditUnit !== 'credits') return null
  if (quota.isMember && quota.freeDaily <= 0) {
    return `本月 ${formatTutorCredits(quota.walletBalance)}/${formatTutorCredits(quota.monthlyGrant)} 代币`
  }
  const daily = `今日赠送 ${formatTutorCredits(quota.freeRemainingToday)}/${formatTutorCredits(quota.freeDaily)} 代币`
  if (!quota.isMember || quota.walletBalance <= 0) {
    return `${daily}\n每次最多使用 ${formatTutorCredits(quota.dailyChargeCap)} 赠送代币`
  }
  return `本月 ${formatTutorCredits(quota.walletBalance)}/${formatTutorCredits(quota.monthlyGrant)} 代币\n${daily}`
}

export function parseTutorBilling(raw: unknown): TutorBilling | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as Record<string, unknown>
  if ((value.source !== 'wallet' && value.source !== 'free') ||
      typeof value.chargedCredits !== 'number' || !Number.isFinite(value.chargedCredits) || value.chargedCredits < 0 ||
      !validCount(value.receiptId) || value.receiptId === 0) return undefined
  // Old receipts may contain raw usage. Only the public credit amount survives
  // parsing; never reinterpret a historical charge using the current tariff.
  return { source: value.source, chargedCredits: value.chargedCredits, receiptId: value.receiptId }
}
