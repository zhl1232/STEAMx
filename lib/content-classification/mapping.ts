import {
  CLASSIFICATION_SOURCES,
  CLASSIFICATION_STATUSES,
  MAX_DIFFICULTY_STARS,
  MIN_DIFFICULTY_STARS,
  SUPPORT_LEVELS,
} from './constants'
import {
  formatDifficultyBandLabel,
  formatEducationStageLabel,
  formatStartingAge,
  formatSupportLevelLabel,
  getDomesticEducationStage,
} from './labels'
import { isClassificationComplete } from './validation'
import type {
  ClassificationSource,
  ClassificationStatus,
  ContentClassification,
  ContentClassificationRow,
  DifficultyBand,
  PublicClassification,
  PublicClassificationEnvelope,
  SupportLevel,
} from './types'

export function mapDifficultyStars(stars: number | null | undefined): DifficultyBand | null {
  if (typeof stars !== 'number' || !Number.isInteger(stars) || stars < MIN_DIFFICULTY_STARS || stars > MAX_DIFFICULTY_STARS) {
    return null
  }

  if (stars <= 2) return 'beginner'
  if (stars <= 4) return 'intermediate'
  return 'challenge'
}

export function mapLegacyDifficultyToBand(value: string | null | undefined): DifficultyBand | null {
  switch (value?.trim().toLowerCase()) {
    case 'easy':
    case 'beginner':
      return 'beginner'
    case 'medium':
    case 'intermediate':
      return 'intermediate'
    case 'hard':
    case 'challenge':
      return 'challenge'
    default:
      return null
  }
}

export function isClassificationStatus(value: unknown): value is ClassificationStatus {
  return typeof value === 'string' && CLASSIFICATION_STATUSES.includes(value as ClassificationStatus)
}

export function isClassificationSource(value: unknown): value is ClassificationSource {
  return typeof value === 'string' && CLASSIFICATION_SOURCES.includes(value as ClassificationSource)
}

export function isSupportLevel(value: unknown): value is SupportLevel {
  return typeof value === 'string' && SUPPORT_LEVELS.includes(value as SupportLevel)
}

export function mapContentClassification(row: ContentClassificationRow): ContentClassification {
  return {
    recommendedMinAge: Number.isInteger(row.recommended_min_age) ? row.recommended_min_age : null,
    recommendedMaxAge: Number.isInteger(row.recommended_max_age) ? row.recommended_max_age : null,
    difficultyBand: mapDifficultyStars(row.difficulty_stars),
    supportLevel: isSupportLevel(row.support_level) ? row.support_level : null,
    status: row.classification_status === 'reviewed' ? 'reviewed' : 'unreviewed',
    source: isClassificationSource(row.classification_source) ? row.classification_source : null,
    reviewedAt: row.classification_reviewed_at,
    reviewedBy: row.classification_reviewed_by,
    revision: Number.isInteger(row.classification_revision) && (row.classification_revision ?? 0) >= 0
      ? row.classification_revision ?? 0
      : 0,
  }
}

export function mapPublicClassification(row: ContentClassificationRow): PublicClassification | null {
  if (!isClassificationComplete(row)) return null

  const difficultyBand = mapDifficultyStars(row.difficulty_stars)
  const supportLevel = isSupportLevel(row.support_level) ? row.support_level : null
  const educationStage = getDomesticEducationStage(row.recommended_min_age ?? 0)
  const ageLabel = formatStartingAge(row.recommended_min_age ?? 0, row.recommended_max_age)

  if (!difficultyBand || !supportLevel || !educationStage || !ageLabel) return null

  return {
    recommendedMinAge: row.recommended_min_age!,
    recommendedMaxAge: row.recommended_max_age,
    ageLabel,
    difficultyBand,
    difficultyLabel: formatDifficultyBandLabel(difficultyBand),
    supportLevel,
    supportLabel: formatSupportLevelLabel(supportLevel),
    educationStage,
    educationStageLabel: formatEducationStageLabel(educationStage),
    status: 'reviewed',
  }
}

export function mapPublicClassificationEnvelope(row: ContentClassificationRow): PublicClassificationEnvelope {
  return { classification: mapPublicClassification(row) }
}

export function mapAdminClassification(row: ContentClassificationRow) {
  return {
    ...mapContentClassification(row),
    difficultyStars: row.difficulty_stars,
  }
}
