import {
  DIFFICULTY_BAND_LABELS,
  EDUCATION_STAGE_LABELS,
  MAX_RECOMMENDED_AGE,
  MIN_RECOMMENDED_AGE,
  SUPPORT_LEVEL_LABELS,
} from './constants'
import type { DifficultyBand, EducationStage, SupportLevel } from './types'

export function formatStartingAge(minAge: number, maxAge: number | null): string {
  if (
    !Number.isInteger(minAge) ||
    minAge < MIN_RECOMMENDED_AGE ||
    minAge > MAX_RECOMMENDED_AGE
  ) {
    return ''
  }

  if (
    maxAge !== null &&
    (!Number.isInteger(maxAge) || maxAge < minAge || maxAge > MAX_RECOMMENDED_AGE)
  ) {
    return ''
  }

  return maxAge === null ? `${minAge} 岁起` : `${minAge}-${maxAge} 岁`
}

export function getDomesticEducationStage(age: number): EducationStage | null {
  if (!Number.isInteger(age) || age < MIN_RECOMMENDED_AGE || age > MAX_RECOMMENDED_AGE) {
    return null
  }

  if (age <= 5) return 'preschool'
  if (age <= 11) return 'primary'
  if (age <= 14) return 'junior'
  return 'senior'
}

export function formatEducationStageLabel(stage: EducationStage): string {
  return EDUCATION_STAGE_LABELS[stage]
}

/** K–12 仅供后台/交换，不作为中文前台的主要分级体系。 */
export function getK12Level(age: number): string | null {
  if (!Number.isInteger(age) || age < MIN_RECOMMENDED_AGE || age > MAX_RECOMMENDED_AGE) {
    return null
  }

  if (age <= 4) return 'Pre-K'
  if (age === 5) return 'K'
  return `Grade ${age - 5}`
}

export function formatDifficultyBandLabel(band: DifficultyBand): string {
  return DIFFICULTY_BAND_LABELS[band]
}

export function formatSupportLevelLabel(level: SupportLevel): string {
  return SUPPORT_LEVEL_LABELS[level]
}

export function formatClassificationSummary(input: {
  recommendedMinAge: number
  recommendedMaxAge: number | null
  difficultyBand: DifficultyBand
  supportLevel: SupportLevel
}): string {
  return [
    formatStartingAge(input.recommendedMinAge, input.recommendedMaxAge),
    formatDifficultyBandLabel(input.difficultyBand),
    formatSupportLevelLabel(input.supportLevel),
  ].join(' · ')
}
