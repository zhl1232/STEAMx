import { describe, expect, it } from 'vitest'

import {
  buildTopicCategoryStats,
  buildTopicHotspotSummaries,
  getTopicObservationIds,
  type TopicHotspotObservationInput,
  type TopicHotspotSpeciesInput,
} from './nature-observation-hotspots'

function speciesByEvent(entries: Array<[number, TopicHotspotSpeciesInput[]]>) {
  return new Map<number, TopicHotspotSpeciesInput[]>(entries)
}

describe('buildTopicHotspotSummaries', () => {
  it('groups locations and summarizes recently observed species', () => {
    const observations: TopicHotspotObservationInput[] = [
      {
        id: 1,
        observedAt: '2026-04-20T08:00:00.000Z',
        locationName: ' 奥林匹克森林公园南园湿地 ',
        latitude: 40.018,
        longitude: 116.392,
      },
      {
        id: 2,
        observedAt: '2026-04-23T10:12:00.000Z',
        locationName: '奥林匹克森林公园南园湿地',
        latitude: null,
        longitude: null,
      },
      {
        id: 3,
        observedAt: '2026-04-21T07:30:00.000Z',
        locationName: '校园树林',
        latitude: null,
        longitude: null,
      },
    ]

    const result = buildTopicHotspotSummaries(
      observations,
      speciesByEvent([
        [
          1,
          [
            { speciesId: 11, speciesSlug: 'parus-minor', commonName: '大山雀', count: 2 },
            { speciesId: 12, speciesSlug: 'cyanopica-cyanus', commonName: '灰喜鹊', count: null },
          ],
        ],
        [2, [{ speciesId: 11, speciesSlug: 'parus-minor', commonName: '大山雀', count: 1 }]],
        [3, [{ speciesId: 13, speciesSlug: 'passer-montanus', commonName: '树麻雀', count: 5 }]],
      ]),
    )

    expect(result[0]).toMatchObject({
      locationName: '奥林匹克森林公园南园湿地',
      observationCount: 2,
      latestObservedAt: '2026-04-23T10:12:00.000Z',
      latitude: 40.018,
      longitude: 116.392,
    })
    expect(result[0]?.species).toEqual([
      {
        speciesId: 11,
        speciesSlug: 'parus-minor',
        commonName: '大山雀',
        scientificName: null,
        observationCount: 2,
        totalCount: 3,
        latestObservedAt: '2026-04-23T10:12:00.000Z',
      },
      {
        speciesId: 12,
        speciesSlug: 'cyanopica-cyanus',
        commonName: '灰喜鹊',
        scientificName: null,
        observationCount: 1,
        totalCount: null,
        latestObservedAt: '2026-04-20T08:00:00.000Z',
      },
    ])
    expect(result[1]).toMatchObject({
      locationName: '校园树林',
      observationCount: 1,
      latitude: null,
      longitude: null,
    })
  })

  it('skips records without location or identified topic species and applies limits', () => {
    const observations: TopicHotspotObservationInput[] = [
      { id: 1, observedAt: '2026-04-24T08:00:00.000Z', locationName: '北海公园' },
      { id: 2, observedAt: '2026-04-25T08:00:00.000Z', locationName: '' },
      { id: 3, observedAt: '2026-04-26T08:00:00.000Z', locationName: '天坛公园' },
    ]

    const result = buildTopicHotspotSummaries(
      observations,
      speciesByEvent([
        [
          1,
          [
            { speciesId: 21, speciesSlug: 'egret', commonName: '白鹭' },
            { speciesId: 22, speciesSlug: 'mallard', commonName: '绿头鸭' },
          ],
        ],
        [2, [{ speciesId: 23, speciesSlug: 'magpie', commonName: '喜鹊' }]],
      ]),
      { locationLimit: 1, speciesLimit: 1 },
    )

    expect(result).toHaveLength(1)
    expect(result[0]?.locationName).toBe('北海公园')
    expect(result[0]?.species).toHaveLength(1)
    expect(result[0]?.species?.[0]?.commonName).toBe('白鹭')
  })
})

describe('topic category helpers', () => {
  it('counts only observations and locations linked to the selected topic species', () => {
    const stats = buildTopicCategoryStats(
      [101, 102],
      [
        { id: 1, locationName: '社区花园' },
        { id: 2, locationName: '社区花园' },
        { id: 3, locationName: '湿地公园' },
        { id: 4, locationName: '校园操场' },
      ],
      [
        { observationEventId: 1, speciesId: 101 },
        { observationEventId: 1, speciesId: 999 },
        { observationEventId: 2, speciesId: 102 },
        { observationEventId: 3, speciesId: 999 },
        { observationEventId: 4, speciesId: 101 },
        { observationEventId: 999, speciesId: 101 },
      ],
    )

    expect(stats).toEqual({
      speciesCount: 2,
      observationCount: 3,
      locationCount: 2,
    })
  })

  it('returns the topic observation ids used by recent-record filtering', () => {
    const observationIds = getTopicObservationIds(
      [101],
      [
        { observationEventId: 1, speciesId: 101 },
        { observationEventId: 2, speciesId: 202 },
        { observationEventId: 3, speciesId: 101 },
      ],
    )

    expect([...observationIds]).toEqual([1, 3])
  })
})
