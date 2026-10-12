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

  it('shows daily and monthly balances as separate credits with the server tier allowance', () => {
    const quota: AiCreditStatus = { creditUnit: 'credits', isMember: false, walletBalance: 0, monthlyGrant: 0,
      freeDaily: 300, freeUsedToday: 12.34, freeRemainingToday: 287.66, dailyChargeCap: 100, dailyPeriod: '2026-10-12',
      grantPeriod: '', dayResetAt: 0, canChat: true }
    expect(formatTutorQuota(quota)).toBe('今日赠送 287.66/300 代币\n每次最多使用 100 赠送代币')
    expect(formatTutorQuota({ ...quota, isMember: true, walletBalance: 1500, monthlyGrant: 20000 }))
      .toBe('本月 1,500/20,000 代币\n今日赠送 287.66/300 代币')
    expect(formatTutorQuota({ ...quota, isMember: true, walletBalance: 0, monthlyGrant: 20000 }))
      .toBe('今日赠送 287.66/300 代币\n每次最多使用 100 赠送代币')
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

  it('preserves small new and historical charges without rounding each reply up to a credit', () => {
    expect(formatTutorCredits(0.001)).toBe('0.001')
    expect(formatTutorCredits(0.01)).toBe('0.01')
    expect(formatTutorCredits(0.1 + 0.2)).toBe('0.3')
    expect(formatTutorCredits(1499.9)).toBe('1,499.9')
  })
})
