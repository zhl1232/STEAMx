import type { TutorBilling } from '@/lib/ai/tutor/types'

/** Keep the SQL reservation/settlement tariff in sync when changing these. */
export const TUTOR_TOKENS_PER_CREDIT = 100
export const TUTOR_MAX_OUTPUT_TOKENS = 8192
export const TUTOR_MAX_TOTAL_TOKENS = 131072

function validCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

export function formatTutorCredits(value: number): string {
  return Number.isFinite(value) ? Number(value.toFixed(3)).toLocaleString('zh-CN', { maximumFractionDigits: 3 }) : '0'
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
