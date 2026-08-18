import { describe, expect, it } from 'vitest'

import { pickReadableLocationName } from './route'

describe('pickReadableLocationName', () => {
  it('prefers the nearest named place over a farther keyword-matching landmark', () => {
    expect(pickReadableLocationName({
      formatted_address: '上海市浦东新区某路 10 号',
      addressComponent: { city: '上海市', district: '浦东新区' },
      pois: [
        { name: '远处公园', type: '风景名胜', distance: '620' },
        { name: '附近小区', type: '住宅区', distance: '42' },
      ],
      aois: [],
    })).toBe('附近小区')
  })

  it('falls back to the administrative area when no named place is returned', () => {
    expect(pickReadableLocationName({
      formatted_address: '上海市浦东新区某路 10 号',
      addressComponent: { city: '上海市', district: '浦东新区' },
      pois: [],
      aois: [],
    })).toBe('浦东新区')
  })
})
