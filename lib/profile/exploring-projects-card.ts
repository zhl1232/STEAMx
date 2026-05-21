import type { Project } from '@/lib/mappers/types'
import { formatRelativeTime } from '@/lib/date-utils'

export type ExploringActivityMeta = {
  projectId: number
  lastActivityAt: string
}

export function buildExploringActivityMap(
  explorations: ExploringActivityMeta[] | undefined,
): Record<number, string> {
  if (!explorations?.length) return {}
  return Object.fromEntries(
    explorations.map((row) => [row.projectId, row.lastActivityAt] as const),
  )
}

export function getExploringCardSubtitle(
  project: Project,
  lastActivityAt?: string | null,
): string {
  if (lastActivityAt) {
    const relative = formatRelativeTime(lastActivityAt)
    if (relative) return relative
  }

  const description = project.description?.trim()
  if (description) return description

  return '继续探索'
}
