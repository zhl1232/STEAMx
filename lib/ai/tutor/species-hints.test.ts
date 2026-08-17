import { describe, expect, it } from 'vitest'

import { buildSpeciesHintsSummary } from '@/lib/ai/tutor/species-hints'

describe('buildSpeciesHintsSummary', () => {
  it('separates habitat notes from observation locations', () => {
    const summary = buildSpeciesHintsSummary([
      {
        slug: 'lanius-cristatus',
        label: '红尾伯劳',
        habitatNotes: '喜欢林缘、草地、农田等开阔生境，在北京市区公园的灌丛、草坪区域也能见到。',
        observationLocations: [{ locationName: '永定河', observationCount: 3 }],
        audioRef: {
          slug: 'lanius-cristatus',
          label: '红尾伯劳',
          audioUrl: '/birds/audio/lanius-cristatus.ogg',
        },
      },
    ])

    expect(summary).toContain('常见环境：喜欢林缘、草地、农田')
    expect(summary).toContain('本站公开观察记录：永定河（3次）')
    expect(summary).toContain('不要把观察地点说成「常见于XX」')
    expect(summary).not.toContain('你曾在')
  })
})
