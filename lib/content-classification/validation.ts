import {
  CLASSIFICATION_INVALIDATION_FIELDS,
  MAX_DIFFICULTY_STARS,
  MAX_RECOMMENDED_AGE,
  MIN_DIFFICULTY_STARS,
  MIN_RECOMMENDED_AGE,
} from './constants'
import { mapLegacyDifficultyToBand, isSupportLevel } from './mapping'
import type {
  ClassificationInput,
  ClassificationValidationResult,
  ContentChangeSet,
  ContentClassificationRow,
  DifficultyBand,
} from './types'

const INVALIDATION_FIELD_SET = new Set<string>(CLASSIFICATION_INVALIDATION_FIELDS)

export { isSupportLevel } from './mapping'

export function isValidRecommendedAge(age: number | null | undefined): boolean {
  return age === null || (
    typeof age === 'number' &&
    Number.isInteger(age) &&
    age >= MIN_RECOMMENDED_AGE &&
    age <= MAX_RECOMMENDED_AGE
  )
}

export function isValidDifficultyStars(stars: number | null | undefined): boolean {
  return typeof stars === 'number' && Number.isInteger(stars) && stars >= MIN_DIFFICULTY_STARS && stars <= MAX_DIFFICULTY_STARS
}

export function validateClassificationInput(input: ClassificationInput): ClassificationValidationResult {
  const errors: string[] = []

  if (!isValidRecommendedAge(input.recommendedMinAge)) {
    errors.push('recommendedMinAge must be an integer between 3 and 16 or null')
  }
  if (!isValidRecommendedAge(input.recommendedMaxAge)) {
    errors.push('recommendedMaxAge must be an integer between 3 and 16 or null')
  }
  if (
    input.recommendedMinAge !== null &&
    input.recommendedMaxAge !== null &&
    input.recommendedMaxAge < input.recommendedMinAge
  ) {
    errors.push('recommendedMaxAge must be greater than or equal to recommendedMinAge')
  }
  if (input.supportLevel !== null && !isSupportLevel(input.supportLevel)) {
    errors.push('supportLevel is invalid')
  }
  if (input.difficultyStars !== null && !isValidDifficultyStars(input.difficultyStars)) {
    errors.push('difficultyStars must be an integer between 1 and 6 or null')
  }

  return { valid: errors.length === 0, errors }
}

/** reviewed 内容必须具备人工来源、审核人和完整三轴。 */
export function isClassificationComplete(row: ContentClassificationRow): boolean {
  return (
    row.classification_status === 'reviewed' &&
    row.recommended_min_age !== null &&
    isValidRecommendedAge(row.recommended_min_age) &&
    isValidRecommendedAge(row.recommended_max_age) &&
    (row.recommended_max_age === null || row.recommended_max_age >= row.recommended_min_age) &&
    isSupportLevel(row.support_level) &&
    isValidDifficultyStars(row.difficulty_stars) &&
    row.classification_source === 'manual' &&
    typeof row.classification_reviewed_at === 'string' &&
    row.classification_reviewed_at.length > 0 &&
    typeof row.classification_reviewed_by === 'string' &&
    row.classification_reviewed_by.length > 0
  )
}

export function doesContentChangeInvalidateClassification(input: ContentChangeSet): boolean {
  for (const rawField of input.changedFields) {
    const field = rawField.trim().toLowerCase()
    if (!field) continue

    if (INVALIDATION_FIELD_SET.has(field)) return true
    if (field.startsWith('course_lessons.') || field.startsWith('course_lesson.')) return true
    if (field.startsWith('project_steps.') || field.startsWith('project_materials.')) return true
    if (field.startsWith('stages.') || field.startsWith('resources.')) return true
  }

  return false
}

export function normalizeDifficultyParam(value: string | null | undefined): DifficultyBand | null {
  const normalized = value?.trim().toLowerCase()
  if (!normalized || normalized === 'all') return null

  if (normalized === '1' || normalized === '2' || normalized === '1-2' || normalized === 'easy' || normalized === 'beginner') {
    return 'beginner'
  }
  if (normalized === '3' || normalized === '4' || normalized === '3-4' || normalized === 'medium' || normalized === 'intermediate') {
    return 'intermediate'
  }
  if (normalized === '5' || normalized === '6' || normalized === '5-6' || normalized === 'hard' || normalized === 'challenge') {
    return 'challenge'
  }

  return null
}

export function normalizeDifficultyParamWithValidity(value: string | null | undefined): {
  band: DifficultyBand | null
  provided: boolean
  valid: boolean
} {
  const provided = Boolean(value?.trim()) && value?.trim().toLowerCase() !== 'all'
  const band = normalizeDifficultyParam(value)
  return { band, provided, valid: !provided || band !== null }
}

export function parseAgeParam(value: string | null | undefined): number | null {
  if (!value?.trim() || !/^\d+$/.test(value.trim())) return null
  const age = Number(value)
  return Number.isInteger(age) && age >= MIN_RECOMMENDED_AGE && age <= MAX_RECOMMENDED_AGE ? age : null
}

export function mapDifficultyInput(value: string | null | undefined): DifficultyBand | null {
  return mapLegacyDifficultyToBand(value)
}
