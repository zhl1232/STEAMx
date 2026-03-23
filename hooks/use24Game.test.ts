import { describe, expect, it } from 'vitest'
import { normalize24Expression, validate24Expression } from './use24Game'

describe('24 game expression validation', () => {
  it('accepts face-card tokens in expressions', () => {
    expect(normalize24Expression('(K - A) * 2')).toBe('(13 - 1) * 2')

    expect(
      validate24Expression('K + J + A - A', [13, 11, 1, 1]),
    ).toEqual({
      valid: true,
      result: 24,
    })
  })

  it('rejects division by zero with a specific error', () => {
    expect(
      validate24Expression('6/(1-1)+12', [6, 1, 1, 12]),
    ).toEqual({
      valid: false,
      result: 0,
      error: '除数不能为 0',
    })
  })
})
