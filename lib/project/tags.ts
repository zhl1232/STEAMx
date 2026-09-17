/**
 * Project tag helpers. Source-tracking tags stay in the database for
 * idempotent imports but must not appear as chips or filter options.
 */

const INTERNAL_PROJECT_TAG_RE = /^(?:qimeng|wanzhuan)-src:/i

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
