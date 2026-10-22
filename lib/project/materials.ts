import type { Project } from '@/lib/mappers/types'
import { splitMaterialPreparation } from '@/lib/explore/material-matching'
import { mergeBrokenParenMaterials } from './presentation'
import { getProjectVideoPresentationPilot } from './video-presentation-pilot'

/** Shared material presentation for effective project content, including quantities. */
export function resolveProjectMaterials(project: Project): { materials: string[]; preparationNotes: string[] } {
  const sourceRows = getProjectVideoPresentationPilot(project)?.materials ?? project.materials ?? []
  return splitMaterialPreparation(mergeBrokenParenMaterials(sourceRows))
}
