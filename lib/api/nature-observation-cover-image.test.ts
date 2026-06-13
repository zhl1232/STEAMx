import { describe, expect, it } from 'vitest'

import { mapSpeciesRowWithCoverImages } from './nature-observation-cover-image'
import type { SpeciesRow } from './nature-observation-internal-types'

function buildSpeciesRow(overrides: Partial<SpeciesRow> = {}): SpeciesRow {
  return {
    id: 1,
    slug: 'citrus-harumi-shiranui',
    common_name: '丑橘',
    scientific_name: 'Citrus harumi × C. shiranui',
    aliases: [],
    taxon_group: '芸香科 柑橘属',
    nature_topic: 'plants',
    life_form: 'tree',
    cultivation_status: 'cultivated',
    plant_uses: ['fruit', 'edible'],
    identification_notes: null,
    habitat_notes: null,
    seasonality_notes: null,
    cover_image_url: null,
    audio_url: null,
    is_active: true,
    created_at: '2026-06-13T00:00:00.000Z',
    updated_at: '2026-06-13T00:00:00.000Z',
    ...overrides,
  }
}

describe('mapSpeciesRowWithCoverImages', () => {
  it('falls back to the first manifest image when the database cover is empty', () => {
    const { normalizedRow, imageUrls } = mapSpeciesRowWithCoverImages(buildSpeciesRow())

    expect(imageUrls[0]).toBe('/fruits/images/citrus-harumi-shiranui-1.jpg')
    expect(normalizedRow.cover_image_url).toBe('/fruits/images/citrus-harumi-shiranui-1.jpg')
  })

  it('prefers a local cover image over the remote asset URL when both exist', () => {
    const previousBaseUrl = process.env.NEXT_PUBLIC_ASSETS_BASE_URL
    process.env.NEXT_PUBLIC_ASSETS_BASE_URL = 'https://assets.steamx.cc'

    try {
      const { normalizedRow, imageUrls } = mapSpeciesRowWithCoverImages(
        buildSpeciesRow({
          slug: 'helianthus-annuus',
          common_name: '向日葵',
          cover_image_url: '/fruits/images/helianthus-annuus-1.jpg',
        }),
      )

      expect(imageUrls[0]).toBe('/fruits/images/helianthus-annuus-1.jpg')
      expect(normalizedRow.cover_image_url).toBe('/fruits/images/helianthus-annuus-1.jpg')
    } finally {
      process.env.NEXT_PUBLIC_ASSETS_BASE_URL = previousBaseUrl
    }
  })
})
