import { describe, expect, it } from 'vitest'

import {
  buildClassificationCandidate,
  buildClassificationJsonLd,
  doesContentChangeInvalidateClassification,
  formatStartingAge,
  getDomesticEducationStage,
  getK12Level,
  getAgeMatchRank,
  isClassificationComplete,
  mapDifficultyStars,
  normalizeDifficultyParam,
} from '@/lib/content-classification'

describe('content classification mapping', () => {
  it('maps all six internal star values to exactly three public bands', () => {
    expect([1, 2, 3, 4, 5, 6].map(mapDifficultyStars)).toEqual([
      'beginner',
      'beginner',
      'intermediate',
      'intermediate',
      'challenge',
      'challenge',
    ])
  })

  it('rejects invalid internal difficulty values', () => {
    expect(mapDifficultyStars(null)).toBeNull()
    expect(mapDifficultyStars(0)).toBeNull()
    expect(mapDifficultyStars(7)).toBeNull()
    expect(mapDifficultyStars(2.5)).toBeNull()
  })

  it('normalizes old and new difficulty query values', () => {
    expect(['1', '2', '1-2', 'easy', 'beginner'].map(normalizeDifficultyParam)).toEqual([
      'beginner',
      'beginner',
      'beginner',
      'beginner',
      'beginner',
    ])
    expect(['3-4', 'medium', 'intermediate'].map(normalizeDifficultyParam)).toEqual([
      'intermediate',
      'intermediate',
      'intermediate',
    ])
    expect(['5-6', 'hard', 'challenge'].map(normalizeDifficultyParam)).toEqual([
      'challenge',
      'challenge',
      'challenge',
    ])
    expect(normalizeDifficultyParam('unknown')).toBeNull()
  })
})

describe('content classification labels and boundaries', () => {
  it('formats starting age while preserving NULL max age as an open range', () => {
    expect(formatStartingAge(6, null)).toBe('6 岁起')
    expect(formatStartingAge(6, 9)).toBe('6-9 岁')
    expect(formatStartingAge(2, null)).toBe('')
    expect(formatStartingAge(6, 5)).toBe('')
  })

  it('maps domestic and K-12 education stages at the documented boundaries', () => {
    expect([3, 5, 6, 11, 12, 14, 15, 16].map(getDomesticEducationStage)).toEqual([
      'preschool',
      'preschool',
      'primary',
      'primary',
      'junior',
      'junior',
      'senior',
      'senior',
    ])
    expect([3, 4, 5, 6, 16].map(getK12Level)).toEqual(['Pre-K', 'Pre-K', 'K', 'Grade 1', 'Grade 11'])
    expect(getDomesticEducationStage(17)).toBeNull()
    expect(getK12Level(2)).toBeNull()
  })
})

describe('content classification completeness and invalidation', () => {
  const reviewedRow = {
    recommended_min_age: 6,
    recommended_max_age: null,
    support_level: 'guided',
    classification_status: 'reviewed',
    classification_source: 'manual',
    classification_reviewed_at: '2026-08-25T00:00:00.000Z',
    classification_reviewed_by: 'reviewer-1',
    classification_revision: 1,
    difficulty_stars: 3,
  } as const

  it('requires a manual reviewer and all three axes for reviewed content', () => {
    expect(isClassificationComplete(reviewedRow)).toBe(true)
    expect(isClassificationComplete({ ...reviewedRow, classification_source: 'rules_v1' })).toBe(false)
    expect(isClassificationComplete({ ...reviewedRow, support_level: null })).toBe(false)
    expect(isClassificationComplete({ ...reviewedRow, difficulty_stars: null })).toBe(false)
  })

  it('invalidates semantic content fields but not operational presentation fields', () => {
    expect(doesContentChangeInvalidateClassification({ changedFields: ['description'] })).toBe(true)
    expect(doesContentChangeInvalidateClassification({ changedFields: ['course_lessons.content'] })).toBe(true)
    expect(doesContentChangeInvalidateClassification({ changedFields: ['image_url', 'sort_order'] })).toBe(false)
    expect(doesContentChangeInvalidateClassification({ changedFields: ['updated_at'] })).toBe(false)
  })
})

describe('content classification candidates and age ranking', () => {
  it('creates an unreviewed safety candidate without claiming a final review', () => {
    const candidate = buildClassificationCandidate({
      title: '纸杯小车 6+',
      description: '使用剪刀和胶枪完成车身。',
      difficultyStars: 3,
    })

    expect(candidate).toMatchObject({
      recommendedMinAge: 6,
      supportLevel: 'adult_required',
      difficultyStars: 3,
      difficultyBand: 'intermediate',
      source: 'rules_v1',
      status: 'unreviewed',
    })
    expect(candidate.confidence).toBe('high')
    expect(candidate.safetyKeywords).toEqual(['剪刀', '胶枪'])
  })

  it('suggests six as a medium-confidence starting age for Scratch and programming content', () => {
    const candidate = buildClassificationCandidate({
      title: 'Scratch 少儿编程入门',
      description: '用图形化积木编程制作一个会动的小故事。',
      difficultyStars: 2,
    })

    expect(candidate).toMatchObject({
      recommendedMinAge: 6,
      confidence: 'medium',
    })
    expect(candidate.matchedRules).toContain('heuristic_programming_age')
  })

  it('suggests eight for strategy and board-game content without treating it as final', () => {
    const candidate = buildClassificationCandidate({
      title: '五子棋博弈论入门',
      description: '认识基本落子、攻防和策略。',
      difficultyStars: 3,
    })

    expect(candidate).toMatchObject({
      recommendedMinAge: 8,
      confidence: 'medium',
    })
    expect(candidate.matchedRules).toContain('heuristic_strategy_age')
  })

  it('uses steps, stages, materials, and complex concepts for a structure suggestion', () => {
    const candidate = buildClassificationCandidate({
      title: '鸡蛋快递保护舱挑战',
      description: '需要制作原型并进行多轮优化，满足承重和约束条件。',
      materials: Array.from({ length: 12 }, (_, index) => `材料${index + 1}`),
      steps: Array.from({ length: 10 }, (_, index) => ({ title: `步骤${index + 1}` })),
      stages: [{ title: '设计' }, { title: '制作' }, { title: '测试' }, { title: '改进' }],
      difficultyStars: 4,
    })

    expect(candidate).toMatchObject({
      recommendedMinAge: 8,
      confidence: 'medium',
    })
    expect(candidate.matchedRules).toContain('heuristic_structure_age')
  })

  it('ranks a matching age before nearby and distant content', () => {
    const classification = {
      recommendedMinAge: 6,
      recommendedMaxAge: 9,
      ageLabel: '6-9 岁',
      difficultyBand: 'beginner' as const,
      difficultyLabel: '入门',
      supportLevel: 'guided' as const,
      supportLabel: '建议成人陪同',
      educationStage: 'primary' as const,
      educationStageLabel: '小学',
      status: 'reviewed' as const,
    }

    expect(getAgeMatchRank(8, classification)).toBe(0)
    expect(getAgeMatchRank(11, classification)).toBe(1)
    expect(getAgeMatchRank(16, classification)).toBe(2)
  })

  it('only emits JSON-LD fields for reviewed classifications', () => {
    const classification = {
      recommendedMinAge: 6,
      recommendedMaxAge: null,
      ageLabel: '6 岁起',
      difficultyBand: 'beginner' as const,
      difficultyLabel: '入门',
      supportLevel: 'guided' as const,
      supportLabel: '建议成人陪同',
      educationStage: 'primary' as const,
      educationStageLabel: '小学',
      status: 'reviewed' as const,
    }
    expect(buildClassificationJsonLd(classification)).toEqual({
      typicalAgeRange: '6-',
      educationalLevel: '小学',
    })
    expect(buildClassificationJsonLd(null)).toBeNull()
  })
})
