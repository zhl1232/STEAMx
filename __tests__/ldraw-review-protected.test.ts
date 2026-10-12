import { describe, expect, it } from 'vitest'
import { reviewStatusFor, legacyReviewStatusFor } from '@/lib/courses/ldraw-review'

describe('production protected review status', () => {
  const records = { '3-shu-kou-bei.ldr': { revision: 'approved', confirmedAt: '2026-01-01' } }
  it('keeps a protected model confirmed when neither artifact matches', () => {
    expect(reviewStatusFor('3-shu-kou-bei.ldr', records, 'draft', 'other')).toBe('confirmed')
  })
  it('requires a record even for protected models', () => {
    expect(reviewStatusFor('3-shu-kou-bei.ldr', {}, 'draft')).toBe('unconfirmed')
  })
  it('maps both awaiting review states to legacy pending', () => {
    expect(legacyReviewStatusFor('changed')).toBe('pending')
    expect(legacyReviewStatusFor('unconfirmed')).toBe('pending')
    expect(legacyReviewStatusFor('confirmed')).toBe('confirmed')
  })
})
