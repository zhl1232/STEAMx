import { describe, expect, it } from 'vitest'

import {
  clampTutorFabPosition,
  getDefaultTutorFabPosition,
} from '@/components/features/tutor/tutor-fab-position'

describe('tutor fab position', () => {
  it('uses taller mobile default for playground bottom nav', () => {
    expect(getDefaultTutorFabPosition('default', 390)).toEqual({ right: 16, bottom: 136 })
    expect(getDefaultTutorFabPosition('compact', 390)).toEqual({ right: 16, bottom: 16 })
  })

  it('clamps inside the viewport', () => {
    expect(clampTutorFabPosition({ right: -20, bottom: 9999 }, 80, 390, 700)).toEqual({
      right: 8,
      bottom: 612,
    })
  })
})
