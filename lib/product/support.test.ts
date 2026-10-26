import { describe, expect, it } from 'vitest'
import { PLATFORM_SUPPORT_HREF, resolveSupportHref } from './support'

describe('support destinations', () => {
  it.each(['/about#contact', '/settings/about#contact', '/about#support', '/settings/about#support'])('maps the persisted legacy target %s to support', value => {
    expect(resolveSupportHref(value)).toBe('/support')
  })
  it.each([undefined, null, {}, 1, '', '//example.com', 'https://example.com', 'javascript:alert(1)', '/a/../b', '/bad path'])('rejects unsafe or non-string settings: %s', value => {
    expect(resolveSupportHref(value)).toBe(PLATFORM_SUPPORT_HREF)
  })
  it.each(['/help#support', '/settings/about#wechat-support', '/support'])('preserves a valid customized internal destination: %s', value => {
    expect(resolveSupportHref(value)).toBe(value)
  })
})
