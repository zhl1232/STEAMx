import { describe, expect, it } from 'vitest'

import { wgs84ToGcj02 } from './wgs84-gcj02'

describe('wgs84ToGcj02', () => {
  it('converts mainland China EXIF coordinates without a provider key', () => {
    const converted = wgs84ToGcj02(31.2304, 121.4737)

    expect(converted.latitude).toBeCloseTo(31.228457, 5)
    expect(converted.longitude).toBeCloseTo(121.478224, 5)
  })

  it('leaves coordinates outside China unchanged', () => {
    expect(wgs84ToGcj02(35.6762, 139.6503)).toEqual({ latitude: 35.6762, longitude: 139.6503 })
  })
})
