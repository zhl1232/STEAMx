import type { Project } from '@/lib/mappers/types'
import type { ExperimentKit, KitProjectRelation } from './types'

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}

export function hasVisualMatchEvidence(relation: Pick<KitProjectRelation, 'evidence'>): boolean {
  const evidence = record(relation.evidence)
  return evidence !== null && Object.hasOwn(evidence, 'visualMatch')
}

/** Visual review permits a directory link; it does not establish preparation coverage. */
export function hasKitVisualMatch(
  kit: ExperimentKit,
  relation: KitProjectRelation,
  project: Pick<Project, 'id' | 'title' | 'videoUrl'>,
): boolean {
  const match = record(record(relation.evidence)?.visualMatch)
  if (!match || relation.status === 'excluded' || relation.kit_revision !== kit.revision
    || relation.kit_id !== kit.id || relation.project_id !== Number(project.id)) return false
  const sha256 = /^[a-f0-9]{64}$/
  return match.scope === 'matching_core_structure'
    && Boolean(project.title.trim()) && match.projectTitle === project.title
    && Boolean(project.videoUrl) && match.videoUrl === project.videoUrl
    && Boolean(kit.cover_url) && match.kitCoverUrl === kit.cover_url
    && typeof match.videoSha256 === 'string' && sha256.test(match.videoSha256)
    && typeof match.kitImageSha256 === 'string' && sha256.test(match.kitImageSha256)
    && typeof match.catalogTitle === 'string' && Boolean(match.catalogTitle.trim())
    && typeof match.reviewedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(match.reviewedAt)
    && Number.isFinite(Date.parse(match.reviewedAt))
}

/** Preparation pages may link reviewed kits while retaining their preparation-only content. */
export function projectMaterialKitMatches<T extends { visualMatch?: boolean }>(
  matches: T[],
  sample?: { mode?: string; sourceRelation?: string } | null,
): T[] {
  if (sample?.mode === 'observation' || sample?.sourceRelation === 'alternative') return []
  return sample?.mode === 'preparation' ? matches.filter(match => match.visualMatch) : matches
}
