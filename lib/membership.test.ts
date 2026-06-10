import { describe, expect, it } from 'vitest'

import {
  AI_CREDIT_COST_TEXT,
  AI_CREDIT_COST_VISION,
  FREE_AI_DAILY_QUOTA,
  MEMBER_AI_MONTHLY_CREDITS,
  getAiChatCreditCost,
  getMembershipSummary,
  isMembershipActive,
} from './membership'

const now = new Date('2026-06-09T12:00:00.000Z')

describe('membership helpers', () => {
  it('treats missing membership fields as a free user', () => {
    const summary = getMembershipSummary(null, now)

    expect(summary).toMatchObject({
      tier: 'free',
      period: 'none',
      isActive: false,
      label: '普通用户',
      quota: FREE_AI_DAILY_QUOTA,
    })
  })

  it('activates monthly and yearly memberships before expiry', () => {
    expect(isMembershipActive({
      membership_tier: 'pro',
      membership_period: 'monthly',
      membership_started_at: '2026-06-01T00:00:00.000Z',
      membership_expires_at: '2026-07-01T00:00:00.000Z',
    }, now)).toBe(true)

    const yearlySummary = getMembershipSummary({
      membership_tier: 'pro',
      membership_period: 'yearly',
      membership_started_at: '2026-01-01T00:00:00.000Z',
      membership_expires_at: '2027-01-01T00:00:00.000Z',
    }, now)

    expect(yearlySummary).toMatchObject({
      tier: 'pro',
      period: 'yearly',
      isActive: true,
      quota: MEMBER_AI_MONTHLY_CREDITS,
    })
  })

  it('downgrades expired memberships to free entitlements', () => {
    const summary = getMembershipSummary({
      membership_tier: 'pro',
      membership_period: 'monthly',
      membership_started_at: '2026-05-01T00:00:00.000Z',
      membership_expires_at: '2026-06-01T00:00:00.000Z',
    }, now)

    expect(summary).toMatchObject({
      tier: 'free',
      period: 'none',
      isActive: false,
      quota: FREE_AI_DAILY_QUOTA,
      expiresAt: null,
    })
  })

  it('keeps lifetime and founder memberships active without expiry', () => {
    expect(isMembershipActive({
      membership_tier: 'pro',
      membership_period: 'lifetime',
      membership_started_at: '2026-01-01T00:00:00.000Z',
      membership_expires_at: null,
    }, now)).toBe(true)

    const founderSummary = getMembershipSummary({
      membership_tier: 'founder',
      membership_period: 'founder',
      membership_started_at: '2026-01-01T00:00:00.000Z',
      membership_expires_at: null,
    }, now)

    expect(founderSummary).toMatchObject({
      tier: 'founder',
      period: 'founder',
      isActive: true,
      label: '创始会员',
      quota: MEMBER_AI_MONTHLY_CREDITS,
    })
  })

  it('computes chat credit cost by image presence', () => {
    expect(getAiChatCreditCost(false)).toBe(AI_CREDIT_COST_TEXT)
    expect(getAiChatCreditCost(true)).toBe(AI_CREDIT_COST_VISION)
  })
})
