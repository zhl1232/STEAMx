import { describe, expect, it } from 'vitest'
import { formatTutorCredits, formatTutorQuota, parseTutorBilling } from './billing'
import type { AiCreditStatus } from './types'

describe('public tutor credit receipts', () => {
  it('keeps historical charges and removes raw usage instead of applying the new tariff', () => {
    expect(parseTutorBilling({ source: 'wallet', chargedCredits: 0.123, receiptId: 12,
      outputTokens: 123, usageMissing: false, inputTokens: 9000, totalTokens: 9123,
    })).toEqual({ source: 'wallet', chargedCredits: 0.123, receiptId: 12 })
  })

  it('accepts current wallet and free receipts without exposing internal accounting fields', () => {
    const receipt = { source: 'wallet', chargedCredits: 21.01, receiptId: 13 }
    expect(parseTutorBilling(receipt)).toEqual(receipt)
    expect(parseTutorBilling({ ...receipt, source: 'free', chargedCredits: 0, usageMissing: true }))
      .toEqual({ source: 'free', chargedCredits: 0, receiptId: 13 })
    expect(parseTutorBilling({ ...receipt, source: 'free', chargedCredits: 42.31, totalTokens: 4231 }))
      .toEqual({ source: 'free', chargedCredits: 42.31, receiptId: 13 })
  })

  it('shows daily grant for free users and only the monthly wallet for members', () => {
    const quota: AiCreditStatus = { creditUnit: 'credits', isMember: false, walletBalance: 0, monthlyGrant: 0,
      freeDaily: 150, freeUsedToday: 12.34, freeRemainingToday: 137.66, dailyChargeCap: 100, dailyPeriod: '2026-10-13',
      grantPeriod: '', dayResetAt: 0, canChat: true }
    expect(formatTutorQuota(quota)).toBe('今日赠送 137.66/150 代币\n每次最多使用 100 赠送代币')
    // Stale freeDaily>0 on a member must still hide the daily line.
    expect(formatTutorQuota({ ...quota, isMember: true, walletBalance: 1314.494, monthlyGrant: 20000,
      freeDaily: 300, freeRemainingToday: 300 }))
      .toBe('本月 1,314.49/20,000 代币')
    expect(formatTutorQuota({ ...quota, isMember: true, walletBalance: 0, monthlyGrant: 20000,
      freeDaily: 300, freeRemainingToday: 300 }))
      .toBe('本月 0/20,000 代币')
    expect(formatTutorQuota({ ...quota, creditUnit: undefined } as unknown as AiCreditStatus)).toBeNull()
  })

  it('rejects invalid amounts, identities and sources', () => {
    const receipt = { source: 'wallet', chargedCredits: 1, receiptId: 12 }
    for (const patch of [{ source: 'unknown' }, { chargedCredits: -1 }, { chargedCredits: Infinity },
      { chargedCredits: '1' }, { receiptId: 0 }, { receiptId: 1.5 }, { receiptId: Number.MAX_SAFE_INTEGER + 1 }]) {
      expect(parseTutorBilling({ ...receipt, ...patch })).toBeUndefined()
    }
    expect(parseTutorBilling(null)).toBeUndefined()
  })

  it('shows at most two decimal places for credit amounts', () => {
    expect(formatTutorCredits(0.001)).toBe('0')
    expect(formatTutorCredits(0.01)).toBe('0.01')
    expect(formatTutorCredits(0.1 + 0.2)).toBe('0.3')
    expect(formatTutorCredits(1314.494)).toBe('1,314.49')
    expect(formatTutorCredits(1499.9)).toBe('1,499.9')
  })
  it('shows only the monthly wallet for members without a daily grant', () => {
    const quota = { isMember: true, walletBalance: 1500, monthlyGrant: 15000, grantPeriod: '2026-10', creditUnit: 'credits',
      freeDaily: 0, freeUsedToday: 0, freeRemainingToday: 0, dailyChargeCap: 100, dailyPeriod: '2026-10-13' } as never
    expect(formatTutorQuota(quota)).toBe('本月 1,500/15,000 代币')
  })
})
