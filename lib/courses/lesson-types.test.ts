import { describe, expect, it } from 'vitest'

import {
  getLessonTypeDefinition,
  isValidLessonTypeSlug,
  LESSON_TYPE_OPTIONS,
} from './lesson-types'

describe('lesson type registry', () => {
  it('accepts extensible lesson type slugs', () => {
    expect(isValidLessonTypeSlug('scratch')).toBe(true)
    expect(isValidLessonTypeSlug('building_3d')).toBe(true)
    expect(isValidLessonTypeSlug('hardware_lab_1')).toBe(true)
  })

  it('rejects invalid lesson type slugs', () => {
    expect(isValidLessonTypeSlug('3d_building')).toBe(false)
    expect(isValidLessonTypeSlug('Building')).toBe(false)
    expect(isValidLessonTypeSlug('x')).toBe(false)
    expect(isValidLessonTypeSlug('bad-type')).toBe(false)
  })

  it('maps known types and gives unknown valid slugs a safe fallback', () => {
    expect(getLessonTypeDefinition('building_3d').workspace).toBe('building_3d')
    expect(getLessonTypeDefinition('future_lab').workspace).toBe('unsupported')
    expect(LESSON_TYPE_OPTIONS.some((option) => option.value === 'building_3d')).toBe(true)
  })
})
