import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:fs/promises', () => ({ readdir: vi.fn(), readFile: vi.fn() }))
import { readdir, readFile } from 'node:fs/promises'
import { getLdrawReviewRecords, legacyReviewStatusFor, reviewStatusFor } from '@/lib/courses/ldraw-review'

const record = { revision: 'approved', confirmedAt: '2026-01-01T00:00:00.000Z' }
const records = { '3-pang-xie.ldr': record, 'not-a-candidate.ldr': record }

beforeEach(() => vi.resetAllMocks())

describe('reviewStatusFor', () => {
  it.each([
    ['approved', undefined, 'confirmed'],
    ['changed', 'approved', 'confirmed'],
    ['approved', 'other', 'confirmed'],
    ['changed', 'other', 'changed'],
    ['changed', undefined, 'changed'],
    [undefined, undefined, 'changed'],
  ] as const)('compares fresh %s and frozen %s hashes → %s', (fresh, frozen, expected) => {
    expect(reviewStatusFor('3-pang-xie.ldr', records, fresh, frozen)).toBe(expected)
  })

  it('preserves confirmed status for production-protected models', () => {
    expect(reviewStatusFor('3-shu-kou-bei.ldr', { '3-shu-kou-bei.ldr': record }, 'draft', 'other')).toBe('confirmed')
  })

  it('requires a record even when an artifact exists', () => {
    expect(reviewStatusFor('3-pang-xie.ldr', {}, 'approved', 'approved')).toBe('unconfirmed')
  })

  it('does not require candidate membership for an existing confirmation', () => {
    expect(reviewStatusFor('not-a-candidate.ldr', records, 'approved')).toBe('confirmed')
  })

  it('maps both outstanding review states to legacy pending', () => {
    expect(legacyReviewStatusFor('changed')).toBe('pending')
    expect(legacyReviewStatusFor('unconfirmed')).toBe('pending')
    expect(legacyReviewStatusFor('confirmed')).toBe('confirmed')
  })
})

describe('getLdrawReviewRecords', () => {
  it('reads records outside the candidate list without requiring source files', async () => {
    vi.mocked(readdir).mockResolvedValue(['missing-source.ldr.json', 'notes.txt', 'old.ldr.json.tmp'] as never)
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(record))
    expect(await getLdrawReviewRecords()).toEqual({ 'missing-source.ldr': record })
  })

  it('returns no records when the review directory is absent', async () => {
    vi.mocked(readdir).mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }))
    expect(await getLdrawReviewRecords()).toEqual({})
  })
})
