import { createHash } from 'node:crypto'
import type { Project } from '@/lib/mappers/types'
import { resolveProjectMaterials } from '@/lib/project/materials'
import { hashProjectInstructionContent } from '@/lib/project/content-fingerprint'
import { getProjectVideoPresentationPilot } from '@/lib/project/video-presentation-pilot'
import type { ExperimentKit, KitProjectRelation } from './types'
export function hashKitProjectContent(project: Project): string {
  return createHash('sha256').update(JSON.stringify([
    hashProjectInstructionContent(project), resolveProjectMaterials(project),
    project.videoUrl ?? null, getProjectVideoPresentationPilot(project),
  ])).digest('hex')
}
export function isKitRelationConfirmed(kit: ExperimentKit, relation: KitProjectRelation, project: Project): boolean {
  return relation.status === 'confirmed' && relation.kit_revision === kit.revision
    && relation.project_hash === hashKitProjectContent(project)
}
