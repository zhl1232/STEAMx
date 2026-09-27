import { describe, expect, it } from 'vitest'

import { isProvinceBlocked, normalizeBlockedProvinces, normalizeMainlandProvince } from './regions'

describe('native store regions', () => {
  it('accepts mainland provinces and rejects non-mainland labels', () => {
    expect(normalizeMainlandProvince('浙江省')).toBe('浙江省')
    expect(normalizeMainlandProvince('香港特别行政区')).toBeNull()
  })

  it('deduplicates configured blocked provinces and applies the policy', () => {
    const blocked = normalizeBlockedProvinces(['浙江省', '浙江省', '香港特别行政区'])
    expect(blocked).toEqual(['浙江省'])
    expect(isProvinceBlocked('浙江省', blocked)).toBe(true)
    expect(isProvinceBlocked('江苏省', blocked)).toBe(false)
  })
})
