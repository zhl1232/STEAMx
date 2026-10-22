/**
 * Ranking rules for 「你可能还会喜欢」 / 「继续探索这个方向」.
 * Pure functions so they can be unit-tested without Supabase.
 */

export const RELATED_CANDIDATE_LIMIT = 12
/** Candidates whose starting age is more than this many years below the current one are never shown. */
export const RELATED_MAX_AGE_DROP = 3
/** Starting ages within this many years count as "same age range". */
export const RELATED_AGE_WINDOW = 2

export type RelatedRankInput = {
  id: string | number
  subCategoryId?: number | null
  minAge?: number | null
  difficultyStars?: number | null
  popularity?: number | null
}

const known = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/** True when the candidate is far too young for the current project. */
export function isTooYoungForCurrent(currentMinAge: number | null | undefined, candidateMinAge: number | null | undefined): boolean {
  if (!known(currentMinAge) || !known(candidateMinAge)) return false
  return candidateMinAge < currentMinAge - RELATED_MAX_AGE_DROP
}

/**
 * Drops too-young candidates, then sorts: same sub-category → starting age within ±2 →
 * closest difficulty → popularity/completions → id ascending (stable tiebreak).
 */
export function rankRelatedCandidates<T extends RelatedRankInput>(current: RelatedRankInput, candidates: readonly T[]): T[] {
  const currentId = Number(current.id)
  const scored = candidates
    .filter((c) => Number(c.id) !== currentId)
    .filter((c) => !isTooYoungForCurrent(current.minAge, c.minAge))
    .map((c) => ({
      c,
      sameSub: known(current.subCategoryId) && c.subCategoryId === current.subCategoryId ? 1 : 0,
      ageClose: known(current.minAge) && known(c.minAge) && Math.abs(c.minAge - current.minAge) <= RELATED_AGE_WINDOW ? 1 : 0,
      starGap: known(current.difficultyStars) && known(c.difficultyStars)
        ? Math.abs(c.difficultyStars - current.difficultyStars)
        : Number.POSITIVE_INFINITY,
      popularity: known(c.popularity) ? c.popularity : 0,
    }))
  scored.sort((a, b) =>
    b.sameSub - a.sameSub
    || b.ageClose - a.ageClose
    || (a.starGap === b.starGap ? 0 : a.starGap < b.starGap ? -1 : 1)
    || b.popularity - a.popularity
    || Number(a.c.id) - Number(b.c.id))
  return scored.map((s) => s.c)
}
