/** Course identity in the shared catalog. Lesson/workspace URLs stay independent. */
export function courseCatalogHref(courseId: number | string): string {
  return `/courses?course=${encodeURIComponent(String(courseId))}`
}

/** Only one canonical positive safe integer is a valid explicit selection. */
export function parseCourseSelection(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
}
