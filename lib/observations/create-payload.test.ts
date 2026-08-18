import { describe, expect, it } from 'vitest'

import {
  CreateObservationBatchSchema,
  hasDuplicateMediaUrls,
} from './create-payload'

const sampleItem = {
  media_url: '/storage/observations/user-1/a.jpg',
  observed_at: '2026-08-13T02:00:00.000Z',
  observed_at_source: 'photo_exif' as const,
  location_name: '人民公园',
  latitude: 31.231,
  longitude: 121.474,
  location_source: 'photo_exif' as const,
}

describe('CreateObservationBatchSchema', () => {
  it('accepts 1 to 5 items that each carry their own location and time', () => {
    const parsed = CreateObservationBatchSchema.parse({
      is_public: true,
      items: [
        sampleItem,
        {
          ...sampleItem,
          media_url: '/storage/observations/user-1/b.jpg',
          location_name: '世纪公园',
          latitude: 31.241,
          longitude: 121.49,
        },
      ],
    })

    expect(parsed.items).toHaveLength(2)
    expect(parsed.items[0]?.location_name).toBe('人民公园')
    expect(parsed.items[1]?.location_name).toBe('世纪公园')
    expect(parsed.items[0]?.observed_at_source).toBe('photo_exif')
  })

  it('rejects the previous single-record media_urls payload', () => {
    const parsed = CreateObservationBatchSchema.safeParse({
      is_public: true,
      media_urls: ['/storage/observations/user-1/a.jpg'],
      location_name: '人民公园',
      latitude: 31.231,
      longitude: 121.474,
      observed_at: '2026-08-13T02:00:00.000Z',
    })

    expect(parsed.success).toBe(false)
  })

  it('rejects more than 5 items', () => {
    const items = Array.from({ length: 6 }, (_, index) => ({
      ...sampleItem,
      media_url: `/storage/observations/user-1/${index}.jpg`,
    }))

    expect(CreateObservationBatchSchema.safeParse({ items }).success).toBe(false)
  })

  it('does not allow new observations to be made private', () => {
    expect(CreateObservationBatchSchema.safeParse({ is_public: false, items: [sampleItem] }).success).toBe(false)
    expect(CreateObservationBatchSchema.parse({ items: [sampleItem] }).is_public).toBe(true)
  })

  it('detects duplicate media urls in a batch', () => {
    const unique = CreateObservationBatchSchema.parse({
      items: [
        sampleItem,
        { ...sampleItem, media_url: '/storage/observations/user-1/b.jpg' },
      ],
    }).items
    const duplicated = CreateObservationBatchSchema.parse({
      items: [sampleItem, { ...sampleItem, location_name: '世纪公园' }],
    }).items

    expect(hasDuplicateMediaUrls(unique)).toBe(false)
    expect(hasDuplicateMediaUrls(duplicated)).toBe(true)
  })
})
