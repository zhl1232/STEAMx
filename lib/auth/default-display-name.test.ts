import { describe, expect, it } from 'vitest'
import { createDefaultDisplayName, isPhoneBasedDisplayName } from './default-display-name'

describe('createDefaultDisplayName', () => {
  it('creates a neutral four-character nickname without phone data', () => {
    expect(createDefaultDisplayName(new Uint8Array([0, 1, 30, 31]))).toBe('新用户AB89')
  })

  it('requires enough random bytes for the suffix', () => {
    expect(() => createDefaultDisplayName(new Uint8Array([0, 1, 2]))).toThrow(
      'Default display name requires 4 random bytes',
    )
  })
})

describe('isPhoneBasedDisplayName', () => {
  it.each([
    ['13812345678', '+8613812345678'],
    ['+86 138 1234 5678', '+8613812345678'],
    ['8613812345678', '13812345678'],
  ])('recognizes phone-derived display name %s', (displayName, phone) => {
    expect(isPhoneBasedDisplayName(displayName, phone)).toBe(true)
  })

  it('does not treat an ordinary nickname as a phone number', () => {
    expect(isPhoneBasedDisplayName('新用户AB89', '+8613812345678')).toBe(false)
  })
})
