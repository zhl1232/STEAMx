/** @vitest-environment node */

import { describe, expect, it } from 'vitest'

import {
  mapVisionPayloadToAnalysisResult,
  parseObservationVisionPayload,
} from '@/lib/ai/observation-media-analysis'
import type { Database } from '@/lib/supabase/types'

type SpeciesRow = Database['public']['Tables']['species']['Row']

const speciesRows: SpeciesRow[] = [
  {
    id: 1,
    slug: 'passer-montanus',
    common_name: '麻雀',
    scientific_name: 'Passer montanus',
    aliases: ['家雀'],
    taxon_group: '雀科',
    nature_topic: 'birds',
    life_form: null,
    cultivation_status: null,
    plant_uses: [],
    identification_notes: null,
    habitat_notes: null,
    seasonality_notes: null,
    cover_image_url: null,
    audio_url: null,
    observation_difficulty: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    slug: 'parus-minor',
    common_name: '煤山雀',
    scientific_name: 'Parus minor',
    aliases: [],
    taxon_group: '山雀科',
    nature_topic: 'birds',
    life_form: null,
    cultivation_status: null,
    plant_uses: [],
    identification_notes: null,
    habitat_notes: null,
    seasonality_notes: null,
    cover_image_url: null,
    audio_url: null,
    observation_difficulty: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
]

describe('parseObservationVisionPayload', () => {
  it('parses fenced json content', () => {
    const payload = parseObservationVisionPayload(`
\`\`\`json
{"moderation_pass":true,"moderation_reason":null,"quality_pass":true,"quality_reason":null,"note_suggestion":"我看到一只鸟停在枝头，姿态较稳定，周围有绿叶遮挡，可补充记录停留位置和活动状态。","species_candidates":[]}
\`\`\`
`)

    expect(payload.moderation_pass).toBe(true)
    expect(payload.quality_pass).toBe(true)
    expect(payload.note_suggestion).toContain('我看到')
  })
})

describe('mapVisionPayloadToAnalysisResult', () => {
  it('maps matched candidates into passed analysis results', () => {
    const result = mapVisionPayloadToAnalysisResult(
      {
        moderation_pass: true,
        moderation_reason: null,
        quality_pass: true,
        quality_reason: null,
        note_suggestion: '我看到一只体型较小的鸟停在枝头，头部和脸侧特征比较清楚，周围环境为树木枝叶。',
        species_candidates: [
          {
            common_name: '麻雀',
            scientific_name: null,
            confidence: 0.93,
            reason: '体型小，头顶棕褐色，脸侧有黑斑',
          },
          {
            common_name: 'Passer montanus',
            scientific_name: 'Passer montanus',
            confidence: 0.61,
            reason: '学名匹配',
          },
        ],
      },
      speciesRows,
      'qwen3.7-plus',
      { ok: true },
    )

    expect(result.status).toBe('passed')
    expect(result.speciesCandidates).toHaveLength(1)
    expect(result.speciesCandidates[0]).toMatchObject({
      speciesId: 1,
      commonName: '麻雀',
      scientificName: 'Passer montanus',
      confidence: 0.93,
    })
    expect(result.noteSuggestion).toContain('枝头')
    expect(result.noteSuggestion?.startsWith('我')).toBe(true)
  })

  it('normalizes third-person note suggestions into first-person observation voice', () => {
    const result = mapVisionPayloadToAnalysisResult(
      {
        moderation_pass: true,
        moderation_reason: null,
        quality_pass: true,
        quality_reason: null,
        note_suggestion: '画面展示了一只猛禽在蓝天背景下低空飞行，双翼展开呈浅V字形，翼尖黑色，主体清晰。',
        species_candidates: [
          {
            common_name: '麻雀',
            scientific_name: null,
            confidence: 0.93,
            reason: '体型小，头顶棕褐色，脸侧有黑斑',
          },
        ],
      },
      speciesRows,
      'qwen3.7-plus',
      { ok: true },
    )

    expect(result.noteSuggestion).toBe('我看到一只猛禽在蓝天背景下低空飞行，双翼展开呈浅V字形，翼尖黑色，主体清晰。')
  })

  it('marks low quality responses as failed_low_quality', () => {
    const result = mapVisionPayloadToAnalysisResult(
      {
        moderation_pass: true,
        moderation_reason: null,
        quality_pass: false,
        quality_reason: '主体过远且模糊',
        note_suggestion: '画面中的鸟较远，主体不清晰。',
        species_candidates: [
          {
            common_name: '麻雀',
            scientific_name: null,
            confidence: 0.4,
            reason: null,
          },
        ],
      },
      speciesRows,
      'qwen3.7-plus',
      { ok: true },
    )

    expect(result.status).toBe('failed_low_quality')
    expect(result.speciesCandidates).toEqual([])
    expect(result.qualityReason).toBe('主体过远且模糊')
    expect(result.noteSuggestion).toBeNull()
  })

  it('passes usable media without forcing an unmatched identification', () => {
    const result = mapVisionPayloadToAnalysisResult(
      {
        moderation_pass: true,
        moderation_reason: null,
        quality_pass: true,
        quality_reason: null,
        note_suggestion: '画面中的鸟站在浅水区域，腿部较长，周围环境较开阔。',
        species_candidates: [
          {
            common_name: '火烈鸟',
            scientific_name: 'Phoenicopterus roseus',
            confidence: 0.76,
            reason: null,
          },
        ],
      },
      speciesRows,
      'qwen3.7-plus',
      { ok: true },
    )

    expect(result.status).toBe('passed_no_identification')
    expect(result.speciesCandidates).toEqual([])
    expect(result.noteSuggestion).toContain('我看到')
  })
})
