import type { CourseLessonResource } from './types'

/** Teaching references stay on this platform; media/editor URLs are handled separately. */
export function lessonTeachingResources(resources: CourseLessonResource[] | null | undefined): CourseLessonResource[] {
  return (resources ?? []).filter(resource => {
    if (typeof resource.url !== 'string') return false
    const href = resource.url.trim()
    if (!href.startsWith('/')) return false
    try { return new URL(href, 'https://teaching.invalid').origin === 'https://teaching.invalid' } catch { return false }
  })
}
