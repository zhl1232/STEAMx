import { describe, expect, it } from 'vitest'

import { describeObservationActivity } from '@/lib/ai/tutor/student-profile'

describe('describeObservationActivity', () => {
  it('uses natural Chinese instead of internal topic/location format', () => {
    const text = describeObservationActivity('birds', '什刹海公园')

    expect(text).toBe('在什刹海公园观察过鸟类')
    expect(text).not.toContain('birds')
    expect(text).not.toContain('@')
  })

  it('falls back gracefully for missing topic and location', () => {
    expect(describeObservationActivity(null, null)).toBe('观察过自然')
  })
})
