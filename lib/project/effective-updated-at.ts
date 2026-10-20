import publishedContentDates from './published-content-dates.json'
import reviewed from './science-reviewed.data.json'

type ProjectDateSource = {
  id: string | number
  title?: string | null
  category?: string | null
  updatedAt?: string | null
}

const reviewedTitles = new Map(reviewed.map(project => [project.id, project.title]))
const publishedDates = new Map(publishedContentDates.flatMap(release =>
  release.projectIds.map(id => [id, release.updatedAt] as const),
))

/**
 * Only confirmed production content releases may supplement the database date.
 * Keep the same identity gates as the LED/science overrides. Missing evidence,
 * legacy drafts, build times and commits that only reached main add no date.
 */
export function effectiveUpdatedAt(project: ProjectDateSource): string | undefined {
  const id = Number(project.id)
  const hasPublishedOverride = id === 149 || (
    project.category === '科学' && reviewedTitles.has(id) && reviewedTitles.get(id) === project.title
  )
  const dates = [project.updatedAt, hasPublishedOverride ? publishedDates.get(id) : undefined]
    .filter((value): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value)))
    .map(value => Date.parse(value))

  return dates.length ? new Date(Math.max(...dates)).toISOString() : undefined
}
