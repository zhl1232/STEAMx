import { describe, expect, it } from 'vitest'

import {
  DEFAULT_COURSE_STEAM_WEIGHTS,
  validateCourseSteamWeights,
} from '@/lib/courses/config'

describe('validateCourseSteamWeights', () => {
  it('accepts the default five-dimension configuration', () => {
    expect(validateCourseSteamWeights(DEFAULT_COURSE_STEAM_WEIGHTS)).toMatchObject({ valid: true })
  })

  it.each([
    [null, 'null'],
    [[], 'array'],
    [{ S: 1, T: 1, E: 1, A: 1 }, 'missing dimension'],
    [{ S: -1, T: 1, E: 1, A: 1, M: 1 }, 'negative weight'],
    [{ S: 0, T: 0, E: 0, A: 0, M: 0 }, 'all zero'],
    [{ S: Number.NaN, T: 1, E: 1, A: 1, M: 1 }, 'non finite weight'],
    [{ S: 1, T: 1, E: 1, A: 1, M: '1' }, 'string weight'],
  ])('rejects %s', (value, _label) => {
    expect(validateCourseSteamWeights(value).valid).toBe(false)
  })
})
