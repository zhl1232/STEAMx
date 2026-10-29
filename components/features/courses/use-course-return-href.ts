'use client'

import { courseCatalogHref } from '@/lib/courses/catalog-url'

/** The explicit course URL restores the same catalog on every viewport. */
export function useCourseReturnHref(courseId: number) {
  return courseCatalogHref(courseId)
}
