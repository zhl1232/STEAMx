import { describe, expect, it } from 'vitest'
import { parseDashScopeUsage } from '@/lib/ai/dashscope'
import { formatTutorCredits, getTutorAnswerTokens, parseTutorBilling } from './billing'

describe('tutor answer token billing', () => {
  it('excludes prompts, history and reported reasoning from billable output', () => {
    const usage = parseDashScopeUsage({ prompt_tokens: 12000, completion_tokens: 650,
      total_tokens: 12650, completion_tokens_details: { reasoning_tokens: 550 } })
    expect(getTutorAnswerTokens(usage)).toBe(100)
  })

  it('does not guess missing or malformed answer usage from total tokens', () => {
    expect(getTutorAnswerTokens({ totalTokens: 2000 })).toBeNull()
    expect(getTutorAnswerTokens(null)).toBeNull()
    expect(getTutorAnswerTokens({ completionTokens: -1 })).toBeNull()
    expect(getTutorAnswerTokens({ completionTokens: 5.2 })).toBeNull()
    expect(getTutorAnswerTokens({ completionTokens: 5, reasoningTokens: 6 })).toBeNull()
    expect(parseDashScopeUsage({ completion_tokens: -1 })).toBeNull()
    expect(getTutorAnswerTokens(parseDashScopeUsage({ completion_tokens: 100,
      completion_tokens_details: { reasoning_tokens: -1 } }))).toBeNull()
  })

  it('preserves small charges instead of rounding every reply up to a credit', () => {
    expect(formatTutorCredits(0.001)).toBe('0.001')
    expect(formatTutorCredits(0.1 + 0.2)).toBe('0.3')
    expect(formatTutorCredits(1499.9)).toBe('1,499.9')
  })

  it('retains valid unknown usage and rejects invalid public billing metadata', () => {
    const billing = { source: 'wallet', chargedCredits: 0, outputTokens: null, usageMissing: true, receiptId: 12 }
    expect(parseTutorBilling(billing)).toEqual(billing)
    expect(parseTutorBilling({ ...billing, chargedCredits: -1 })).toBeUndefined()
    expect(parseTutorBilling({ ...billing, outputTokens: '100' })).toBeUndefined()
  })
})
