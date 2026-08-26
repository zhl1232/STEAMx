import type { PublicClassification, PublicClassificationSettings } from './types'

export function isPublicClassificationEnabled(settings: PublicClassificationSettings): boolean {
  return settings.publicV1Enabled
}

export function shouldRequireReviewedClassification(settings: PublicClassificationSettings): boolean {
  return settings.enforcementEnabled
}

export function isAgeMatch(age: number, classification: PublicClassification): boolean {
  return age >= classification.recommendedMinAge && (
    classification.recommendedMaxAge === null || age <= classification.recommendedMaxAge
  )
}

export function getAgeMatchRank(age: number, classification: PublicClassification): number {
  if (isAgeMatch(age, classification)) return 0

  const distance = age < classification.recommendedMinAge
    ? classification.recommendedMinAge - age
    : classification.recommendedMaxAge === null
      ? 0
      : age - classification.recommendedMaxAge

  return distance <= 2 ? 1 : 2
}

export function sortByAgeMatch<T extends { classification?: PublicClassification | null }>(
  items: readonly T[],
  age: number | null,
): T[] {
  if (age === null) return [...items]

  return items
    .map((item, index) => ({ item, index, rank: item.classification ? getAgeMatchRank(age, item.classification) : 2 }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map(({ item }) => item)
}

export function buildRecommendedAgePredicate(age: number | null): {
  minAge: number | null
  maxAge: number | null
} {
  return age === null ? { minAge: null, maxAge: null } : { minAge: age, maxAge: age }
}
