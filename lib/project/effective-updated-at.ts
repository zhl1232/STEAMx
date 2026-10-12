import publishedDates from './published-content-dates.json'
import reviewed from './science-reviewed.data.json'

type ProjectDateSource = {
  id: string | number
  title?: string | null
  category?: string | null
  updatedAt?: string | null
}

/** Main publication commits, not draft authoring dates or build times.
 * Update the affected entry only when its reviewed public content changes.
 * Science identity checks mirror getScienceSampleForProject; legacy drafts are excluded.
 */
export function effectiveUpdatedAt(project: ProjectDateSource): string | undefined {
  const id = Number(project.id)
  const hasPublishedOverride = id === 149 || reviewed.some(sample =>
    sample.id === id && sample.title === project.title && project.category === '科学')
  const published = hasPublishedOverride
    ? (publishedDates as Record<string, { updatedAt: string }>)[String(id)]?.updatedAt
    : undefined
  const valid = [project.updatedAt, published].filter((value): value is string =>
    typeof value === 'string' && Number.isFinite(Date.parse(value)))
  return valid.length ? new Date(Math.max(...valid.map(value => Date.parse(value)))).toISOString() : undefined
}
