import { formatEducationStageLabel, formatStartingAge } from './labels'
import type { ClassificationJsonLdFields, PublicClassification } from './types'

export function buildClassificationJsonLd(
  classification: PublicClassification | null | undefined,
): ClassificationJsonLdFields | null {
  if (!classification || classification.status !== 'reviewed') return null

  const typicalAgeRange = classification.recommendedMaxAge === null
    ? `${classification.recommendedMinAge}-`
    : `${classification.recommendedMinAge}-${classification.recommendedMaxAge}`
  const ageLabel = formatStartingAge(classification.recommendedMinAge, classification.recommendedMaxAge)
  const educationLabel = formatEducationStageLabel(classification.educationStage)

  if (!ageLabel || !educationLabel) return null

  return {
    typicalAgeRange,
    educationalLevel: educationLabel,
  }
}
