/**
 * Project tag helpers. Source-tracking tags stay in the database for
 * idempotent imports but must not appear as chips or filter options.
 */

const INTERNAL_PROJECT_TAG_RE = /^[a-z][a-z0-9-]*-src:/i

export function isInternalProjectTag(tag: string | null | undefined): boolean {
  return Boolean(tag && INTERNAL_PROJECT_TAG_RE.test(tag.trim()))
}

export function visibleProjectTags(
  tags: Array<string | null | undefined> | null | undefined,
): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const tag of tags ?? []) {
    const value = tag?.trim()
    if (!value || isInternalProjectTag(value) || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

// Match whole grade labels only; topical tags such as 幼儿科学 stay available.
const GRADE_PROJECT_TAG_RE = /^(?:(?:幼儿园)?[小中大]班|[一二三四五六七八九1-9]年级|初中|高中|初[一二三123]|高[一二三123])$/u

export function isGradeProjectTag(tag: string | null | undefined): boolean {
  return Boolean(tag && GRADE_PROJECT_TAG_RE.test(tag.trim()))
}

export function isSeriesSourceProjectTag(tag: string | null | undefined): boolean {
  return tag?.trim() === '科教版'
}

/** Public chips and keywords omit grades and import series labels. */
export function displayProjectTags(
  tags: Array<string | null | undefined> | null | undefined,
): string[] {
  return visibleProjectTags(tags).filter((tag) => !isGradeProjectTag(tag) && !isSeriesSourceProjectTag(tag))
}

/** Series remain reachable through preset pills, not tag options. */
export function filterOptionProjectTags(
  tags: Array<string | null | undefined> | null | undefined,
): string[] {
  return displayProjectTags(tags)
}

/** Legacy URLs ignore grades but retain series filters used by presets. */
export function sanitizeProjectTagsParam(value: string | null | undefined): string[] {
  return visibleProjectTags(value?.split(',')).filter((tag) => !isGradeProjectTag(tag))
}
