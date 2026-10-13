import { describe, expect, it } from 'vitest'
import { PLATFORM_SUPPORT_HREF, resolveSupportHref } from './support'

describe('support destinations', () => {
  it.each(['/about#contact', '/settings/about#contact'])('maps the persisted legacy target %s to support', value => {
    expect(resolveSupportHref(value)).toBe('/about#support')
  })
  it.each([undefined, null, {}, 1, '', '//example.com', 'https://example.com', 'javascript:alert(1)', '/a/../b', '/bad path'])('rejects unsafe or non-string settings: %s', value => {
    expect(resolveSupportHref(value)).toBe(PLATFORM_SUPPORT_HREF)
  })
  it.each(['/help#support', '/settings/about#wechat-support', '/about#support'])('preserves a valid customized internal destination: %s', value => {
    expect(resolveSupportHref(value)).toBe(value)
  })
})
