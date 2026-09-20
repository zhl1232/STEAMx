import type { DashScopeTokenUsage } from '@/lib/ai/dashscope'
import type { TutorBilling } from '@/lib/ai/tutor/types'

/** Keep the SQL reservation/settlement tariff in sync when changing these. */
export const TUTOR_OUTPUT_TOKENS_PER_CREDIT = 1000
export const TUTOR_MAX_OUTPUT_TOKENS = 8192

function validCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

/** Only the final answer call is billable; never substitute total/prompt tokens. */
export function getTutorAnswerTokens(usage: DashScopeTokenUsage | null | undefined): number | null {
  if (!validCount(usage?.completionTokens)) return null
  const reasoning = usage.reasoningTokens ?? 0
  if (!validCount(reasoning) || reasoning > usage.completionTokens) return null
  return usage.completionTokens - reasoning
}

export function formatTutorCredits(value: number): string {
  return Number.isFinite(value) ? Number(value.toFixed(3)).toLocaleString('zh-CN', { maximumFractionDigits: 3 }) : '0'
}

export function parseTutorBilling(raw: unknown): TutorBilling | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as Record<string, unknown>
  if ((value.source !== 'wallet' && value.source !== 'free') ||
      typeof value.chargedCredits !== 'number' || !Number.isFinite(value.chargedCredits) || value.chargedCredits < 0 ||
      (value.outputTokens !== null && !validCount(value.outputTokens)) ||
      typeof value.usageMissing !== 'boolean' || !validCount(value.receiptId)) return undefined
  return { source: value.source, chargedCredits: value.chargedCredits, outputTokens: value.outputTokens,
    usageMissing: value.usageMissing, receiptId: value.receiptId }
}
