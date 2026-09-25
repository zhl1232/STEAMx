import { describe, expect, it } from 'vitest'

import { maskPhone, toMainlandMobile } from '@/lib/utils/phone'

describe('toMainlandMobile', () => {
  it('normalizes E.164 with or without + and plain 11-digit numbers', () => {
    expect(toMainlandMobile('8613800138000')).toBe('13800138000')
    expect(toMainlandMobile('+86 138-0013-8000')).toBe('13800138000')
    expect(toMainlandMobile('13800138000')).toBe('13800138000')
  })

  it('rejects non-mainland or malformed numbers', () => {
    expect(toMainlandMobile('')).toBeNull()
    expect(toMainlandMobile('8612345')).toBeNull()
    expect(toMainlandMobile('8602112345678')).toBeNull()
    expect(toMainlandMobile('14155552671', { requireCountryCode: true })).toBeNull()
    expect(toMainlandMobile('8614755552671', { requireCountryCode: true })).toBe('14755552671')
  })
})

describe('maskPhone', () => {
  it('keeps only the prefix and last four digits', () => {
    expect(maskPhone('13800138000')).toBe('138****8000')
    expect(maskPhone('+8613800138000')).toBe('861****8000')
    expect(maskPhone('')).toBe('(empty)')
    expect(maskPhone('123')).toBe('***')
  })
})
