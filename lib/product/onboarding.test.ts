import { describe, expect, it } from 'vitest'
import { PLATFORM_START_ACTIONS, getStartCourseCategory } from './onboarding'

describe('mobile onboarding destinations', () => {
  it('offers four peer directions, with no intermediate guide or submit form', () => {
    expect(PLATFORM_START_ACTIONS.map(item => [item.label, item.href])).toEqual([
      ['搭积木', '/courses?category=brick'],
      ['做小实验', '/explore?category=科学'],
      ['学编程', '/courses?category=programming'],
      ['去自然里观察', '/nature'],
    ])
    expect(PLATFORM_START_ACTIONS.every(item => !/\/learn|#first-try|\/submit/.test(item.href))).toBe(true)
  })
  it.each(['brick', 'programming'] as const)('keeps a supported entry category: %s', value => {
    expect(getStartCourseCategory(value)).toBe(value)
  })
  it.each([undefined, '', 'unknown', 'nature', ['brick'], ['brick', 'programming']].map(value => ({ value })))('falls back for malformed or repeated parameters: $value', ({ value }) => {
    expect(getStartCourseCategory(value)).toBe('recommended')
  })
})
