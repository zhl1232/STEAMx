import type { Project } from '@/lib/mappers/types'
import { splitMaterialPreparation } from '@/lib/explore/material-matching'
import { mergeBrokenParenMaterials } from './presentation'
import { getProjectVideoPresentationPilot } from './video-presentation-pilot'
import { getHouseholdProfile } from './household-profile'
import { getProjectRevisionPreparationNotes } from './content-revisions'

/** Shared material presentation for effective project content, including quantities. */
export function resolveProjectMaterials(project: Project): { materials: string[]; preparationNotes: string[] } {
  const sourceRows = getProjectVideoPresentationPilot(project)?.materials ?? project.materials ?? []
  const result = splitMaterialPreparation(mergeBrokenParenMaterials(sourceRows))
  const profile = getHouseholdProfile(project)
  return {
    materials: result.materials,
    preparationNotes: [...new Set([...result.preparationNotes, ...(profile?.preparationNotes ?? []), ...getProjectRevisionPreparationNotes(project)])],
  }
}
