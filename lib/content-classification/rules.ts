import { mapDifficultyStars, mapLegacyDifficultyToBand } from './mapping'
import {
  MAX_RECOMMENDED_AGE,
  MIN_RECOMMENDED_AGE,
} from './constants'
import type {
  ClassificationCandidate,
  ClassificationCandidateSource,
  SupportLevel,
} from './types'

/** 关键词只用于候选和队列优先级，不能替代人工安全判断。 */
export const CLASSIFICATION_SAFETY_KEYWORDS = [
  '剪刀',
  '针',
  '刀',
  '切割',
  '裁纸',
  '热熔胶',
  '胶枪',
  '火',
  '热源',
  '烙铁',
  '电源',
  '插座',
  '化学品',
  '玻璃',
  '重物',
  '高处',
  '钻孔',
  '砂纸',
] as const

const HIGH_RISK_KEYWORDS = new Set([
  '刀',
  '切割',
  '热熔胶',
  '胶枪',
  '火',
  '热源',
  '烙铁',
  '电源',
  '插座',
  '化学品',
  '玻璃',
  '重物',
  '高处',
  '钻孔',
])

const AGE_LABELS: Record<string, number> = {
  小班: 3,
  中班: 4,
  大班: 5,
}

const PRESCHOOL_TARGETING_PATTERN = /学前|幼儿园|幼儿启蒙|幼儿/i
const PRIMARY_TARGETING_PATTERN = /小学|小学生|儿童/i
const JUNIOR_TARGETING_PATTERN = /初中|初中生/i
const SENIOR_TARGETING_PATTERN = /高中|高中生/i
const PROGRAMMING_PATTERN = /scratch|少儿编程|图形化编程|积木编程|编程|程序设计|代码/i
const ADVANCED_PROGRAMMING_PATTERN = /python|javascript|typescript|c\+\+|算法|数据结构|变量|函数|调试|坐标系|传感器/i
const STRATEGY_PATTERN = /五子棋|围棋|象棋|棋类|博弈|策略|战术|概率/i
const COMPLEX_CONCEPT_PATTERN = /算法|数据结构|变量|函数|原型|迭代|优化|策略|博弈|概率|坐标系|工程设计|承重|约束条件/i
const HANDS_ON_ACTIVITY_PATTERN = /积木|搭建|拼搭|手工|模型|实验|观察|制作|小车|桥|高塔/i

function countStructuredItems(value: unknown, depth = 0): number {
  if (depth > 3 || value === null || value === undefined) return 0
  if (Array.isArray(value)) return value.length

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return 0
    try {
      return countStructuredItems(JSON.parse(trimmed) as unknown, depth + 1)
    } catch {
      return 0
    }
  }

  if (typeof value !== 'object') return 0
  const record = value as Record<string, unknown>
  for (const key of ['items', 'steps', 'lessons', 'stages', 'activities', 'challenges', 'tasks']) {
    const count = countStructuredItems(record[key], depth + 1)
    if (count > 0) return count
  }

  return 0
}

function inferHeuristicRecommendedMinAge(
  source: ClassificationCandidateSource,
  text: string,
): { age: number; rule: string } | null {
  const titleAndTags = [source.title, ...(source.tags ?? [])].filter(Boolean).join('\n')

  if (SENIOR_TARGETING_PATTERN.test(titleAndTags)) return { age: 15, rule: 'heuristic_senior_targeting_age' }
  if (JUNIOR_TARGETING_PATTERN.test(titleAndTags)) return { age: 12, rule: 'heuristic_junior_targeting_age' }
  if (PRESCHOOL_TARGETING_PATTERN.test(titleAndTags)) return { age: 4, rule: 'heuristic_preschool_targeting_age' }
  if (PRIMARY_TARGETING_PATTERN.test(titleAndTags)) return { age: 6, rule: 'heuristic_primary_targeting_age' }

  if (PROGRAMMING_PATTERN.test(text)) {
    return {
      age: ADVANCED_PROGRAMMING_PATTERN.test(text) && !/入门|启蒙|基础/i.test(titleAndTags) ? 8 : 6,
      rule: ADVANCED_PROGRAMMING_PATTERN.test(text) && !/入门|启蒙|基础/i.test(titleAndTags)
        ? 'heuristic_programming_concepts_age'
        : 'heuristic_programming_age',
    }
  }

  if (STRATEGY_PATTERN.test(text)) return { age: 8, rule: 'heuristic_strategy_age' }

  const stepCount = Math.max(countStructuredItems(source.steps), countStructuredItems(source.project_steps))
  const lessonCount = countStructuredItems(source.course_lessons)
  const stageCount = countStructuredItems(source.stages)
  const materialCount = Math.max(countStructuredItems(source.materials), countStructuredItems(source.project_materials))
  const hasComplexStructure = stepCount >= 10
    || lessonCount >= 10
    || stageCount >= 4
    || materialCount >= 12
    || (stepCount >= 6 && materialCount >= 6)
    || (stageCount >= 3 && materialCount >= 6)

  if (COMPLEX_CONCEPT_PATTERN.test(text) || hasComplexStructure) {
    return { age: 8, rule: 'heuristic_structure_age' }
  }

  const hasModerateStructure = stepCount >= 6 || lessonCount >= 6 || stageCount >= 3 || materialCount >= 8
  if (hasModerateStructure) return { age: 7, rule: 'heuristic_structure_age' }
  if (stepCount > 0 || lessonCount > 0 || stageCount > 0 || materialCount > 0 || HANDS_ON_ACTIVITY_PATTERN.test(text)) {
    return { age: 6, rule: 'heuristic_activity_age' }
  }

  return null
}

function collectText(source: ClassificationCandidateSource): string {
  const pieces = [
    source.title,
    source.description,
    ...(source.tags ?? []),
    ...(source.materials ?? []),
    source.scenario,
    source.driving_question,
    source.expected_outcome,
    source.constraints,
    ...(source.steps ?? []).flatMap((step) => [step.title, step.description]),
    source.resources,
    source.stages,
    source.project_materials,
    source.project_steps,
    source.course_lessons,
  ]

  if (source.metadata) {
    pieces.push(...Object.values(source.metadata))
  }

  const flatten = (value: unknown, depth = 0): string[] => {
    if (depth > 6 || value === null || value === undefined) return []
    if (typeof value === 'string') return value.trim().length > 0 ? [value] : []
    if (typeof value === 'number' || typeof value === 'boolean') return [String(value)]
    if (Array.isArray(value)) return value.flatMap((item) => flatten(item, depth + 1))
    if (typeof value === 'object') return Object.values(value).flatMap((item) => flatten(item, depth + 1))
    return []
  }

  return pieces.flatMap((piece) => flatten(piece)).join('\n')
}

export function findSafetyKeywords(text: string): string[] {
  const matched = new Set(
    [...CLASSIFICATION_SAFETY_KEYWORDS]
      .sort((left, right) => right.length - left.length)
      .filter((keyword) => text.includes(keyword))
      .filter((keyword, _index, keywords) => !keywords.some((longer) => longer !== keyword && longer.includes(keyword))),
  )

  return CLASSIFICATION_SAFETY_KEYWORDS.filter((keyword) => matched.has(keyword))
}

export function extractRecommendedMinAge(text: string): { age: number | null; rule: string | null } {
  const explicitAge = text.match(/(?:^|[^\d])(3|4|5|6|7|8|9|10|11|12|13|14|15|16)\s*\+\s*(?:岁|$|[^\d])/i)
  if (explicitAge) {
    const age = Number(explicitAge[1])
    return { age, rule: 'explicit_age_plus' }
  }

  const ageStart = text.match(/(?:适合|推荐|建议|从)\s*(3|4|5|6|7|8|9|10|11|12|13|14|15|16)\s*岁/i)
  if (ageStart) {
    return { age: Number(ageStart[1]), rule: 'explicit_starting_age' }
  }

  for (const [label, age] of Object.entries(AGE_LABELS)) {
    if (text.includes(label)) return { age, rule: `${label}_age` }
  }

  return { age: null, rule: null }
}

function inferSupportLevel(safetyKeywords: string[]): SupportLevel | null {
  if (safetyKeywords.some((keyword) => HIGH_RISK_KEYWORDS.has(keyword))) return 'adult_required'
  if (safetyKeywords.length > 0) return 'guided'
  return null
}

export function buildClassificationCandidate(source: ClassificationCandidateSource): ClassificationCandidate {
  const text = collectText(source)
  const matchedRules: string[] = []
  const explicitAgeResult = extractRecommendedMinAge(text)
  const heuristicAgeResult = explicitAgeResult.age === null
    ? inferHeuristicRecommendedMinAge(source, text)
    : null
  const age = explicitAgeResult.age ?? heuristicAgeResult?.age ?? null
  const ageRule = explicitAgeResult.rule ?? heuristicAgeResult?.rule ?? null
  if (ageRule) matchedRules.push(ageRule)

  const difficultyBand = mapDifficultyStars(source.difficultyStars) ?? mapLegacyDifficultyToBand(source.difficulty)
  if (mapDifficultyStars(source.difficultyStars)) matchedRules.push('difficulty_stars_band')
  else if (difficultyBand) matchedRules.push('legacy_difficulty_band_needs_star_confirmation')

  const safetyKeywords = findSafetyKeywords(text)
  if (safetyKeywords.length > 0) matchedRules.push('safety_keyword_priority')

  const supportLevel = inferSupportLevel(safetyKeywords)
  if (supportLevel) matchedRules.push(`safety_support_candidate_${supportLevel}`)

  const validAge = age !== null && age >= MIN_RECOMMENDED_AGE && age <= MAX_RECOMMENDED_AGE
  const validStars = mapDifficultyStars(source.difficultyStars) !== null
  const explicitAge = explicitAgeResult.age !== null
  const confidence: ClassificationCandidate['confidence'] = explicitAge && validAge && validStars
    ? 'high'
      : validAge || validStars
        ? 'medium'
      : 'low'

  return {
    recommendedMinAge: validAge ? age : null,
    recommendedMaxAge: null,
    supportLevel,
    difficultyStars: validStars ? source.difficultyStars! : null,
    difficultyBand,
    source: 'rules_v1',
    status: 'unreviewed',
    confidence,
    matchedRules,
    safetyKeywords,
  }
}

export function getCandidateText(source: ClassificationCandidateSource): string {
  return collectText(source)
}

export function isCandidateAgeInRange(age: number | null): boolean {
  return age === null || (Number.isInteger(age) && age >= MIN_RECOMMENDED_AGE && age <= MAX_RECOMMENDED_AGE)
}

export function isCandidateMaxAgeInRange(minAge: number | null, maxAge: number | null): boolean {
  return maxAge === null || (
    isCandidateAgeInRange(maxAge) &&
    (minAge === null || maxAge >= minAge) &&
    maxAge <= MAX_RECOMMENDED_AGE
  )
}
