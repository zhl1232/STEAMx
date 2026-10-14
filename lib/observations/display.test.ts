import { describe, expect, it } from 'vitest'

import {
  getObservationDisplayTitle,
  getObservationHeadline,
  getSuggestedSpeciesLabel,
} from '@/lib/observations/display'

describe('observation suggested 「其他」 species display', () => {
  const suggestion = { suggestedSpeciesName: '同型巴蜗牛', suggestedScientificName: 'Bradybaena similaris' }

  it('formats the 待确认 label', () => {
    expect(getSuggestedSpeciesLabel(suggestion)).toBe('其他·同型巴蜗牛（待确认）')
    expect(getSuggestedSpeciesLabel({ suggestedSpeciesName: '  ' })).toBeNull()
    expect(getSuggestedSpeciesLabel(null)).toBeNull()
  })

  it('uses the suggestion only when no species is identified', () => {
    expect(getObservationDisplayTitle([], suggestion)).toBe('其他·同型巴蜗牛（待确认）')
    expect(getObservationDisplayTitle([{ commonName: '麻雀' }], suggestion)).toBe('麻雀')
    expect(getObservationDisplayTitle([])).toBe('待鉴定观察')
  })

  it('falls back to the suggestion in the detail headline', () => {
    expect(getObservationHeadline([], [], 'needs_id', 'insects', suggestion)).toEqual({
      title: '其他·同型巴蜗牛（待确认）',
      scientificName: 'Bradybaena similaris',
    })
  })
})
