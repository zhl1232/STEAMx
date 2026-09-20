import { describe, expect, it } from 'vitest'

import {
  buildNatureObservationPageHref,
  parseNatureObservationPage,
} from './nature-observation-pagination'

describe('nature observation pagination URLs', () => {
  it('normalizes malformed pages and preserves only safe integer values', () => {
    for (const value of [undefined, '', '-1', '2junk', '1.2', 'Infinity', '999999999999999999']) {
      expect(parseNatureObservationPage(value)).toBe(0)
    }
    expect(parseNatureObservationPage('2')).toBe(2)
    expect(parseNatureObservationPage(['2', '3'])).toBe(2)
  })

  it('omits page zero and gives later pages distinct crawlable URLs', () => {
    expect(buildNatureObservationPageHref(0)).toBe('/nature/observations')
    expect(buildNatureObservationPageHref(2)).toBe('/nature/observations?page=2')
  })
})
