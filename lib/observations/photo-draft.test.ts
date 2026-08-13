import { describe, expect, it } from 'vitest'

import {
  copyLocationToDraft,
  createEmptyPhotoDraft,
  isPhotoLocated,
  isPhotoPublishReady,
  syncPhotoDrafts,
} from './photo-draft'

describe('observation photo drafts', () => {
  it('treats a photo as located only when name and coordinates are present', () => {
    const empty = createEmptyPhotoDraft('2026-08-13T10:00')
    expect(isPhotoLocated(empty)).toBe(false)
    expect(isPhotoPublishReady(empty)).toBe(false)

    const located = {
      ...empty,
      locationName: '人民公园',
      latitude: '31.231000',
      longitude: '121.474000',
    }
    expect(isPhotoLocated(located)).toBe(true)
    expect(isPhotoPublishReady(located)).toBe(true)
  })

  it('copies location onto an unlocated photo without changing species or time', () => {
    const source = {
      ...createEmptyPhotoDraft('2026-08-13T10:00'),
      speciesId: '12',
      locationName: '人民公园',
      latitude: '31.231000',
      longitude: '121.474000',
      locationSource: 'place_search' as const,
    }
    const target = {
      ...createEmptyPhotoDraft('2026-08-13T11:00'),
      speciesId: '34',
      sex: 'female' as const,
    }

    const copied = copyLocationToDraft(target, source)
    expect(copied.locationName).toBe('人民公园')
    expect(copied.latitude).toBe('31.231000')
    expect(copied.longitude).toBe('121.474000')
    expect(copied.locationSource).toBe('place_search')
    expect(copied.speciesId).toBe('34')
    expect(copied.sex).toBe('female')
    expect(copied.observedAt).toBe('2026-08-13T11:00')
  })

  it('keeps drafts for current photos and drops removed ones', () => {
    const first = createEmptyPhotoDraft('2026-08-13T10:00')
    first.locationName = '人民公园'
    const current = {
      '/a.jpg': first,
      '/gone.jpg': createEmptyPhotoDraft('2026-08-13T09:00'),
    }

    const next = syncPhotoDrafts(['/a.jpg', '/b.jpg'], current, '2026-08-13T12:00')
    expect(next['/a.jpg']?.locationName).toBe('人民公园')
    expect(next['/b.jpg']?.observedAt).toBe('2026-08-13T12:00')
    expect(next['/gone.jpg']).toBeUndefined()
  })
})
