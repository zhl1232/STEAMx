import { describe, expect, it } from 'vitest'
import { courseCatalogHref, parseCourseSelection } from './catalog-url'

describe('course catalog URLs', () => {
  it('addresses the selected course without an intermediate route', () => {
    expect(courseCatalogHref(5)).toBe('/courses?course=5')
    expect(parseCourseSelection('5')).toBe(5)
  })

  it.each([undefined, '', '0', '-1', '01', '1.5', '1e2', ' 5', '9007199254740992', ['5'], ['5', '6']])(
    'rejects ambiguous or invalid selection %j', (value) => {
      expect(parseCourseSelection(value)).toBeNull()
    },
  )
})
