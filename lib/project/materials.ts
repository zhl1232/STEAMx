import type { Project } from '@/lib/mappers/types'
import { splitMaterialPreparation } from '@/lib/explore/material-matching'
import { mergeBrokenParenMaterials } from './presentation'
import { getProjectVideoPresentationPilot } from './video-presentation-pilot'
import { getHouseholdProfile } from './household-profile'
import { getProjectRevisionPreparationNotes } from './content-revisions'
import { normalizeMaterialPresentation } from './material-presentation'

/** Shared material presentation for effective project content, including quantities. */
export function resolveProjectMaterials(project: Project): { materials: string[]; preparationNotes: string[] } {
  const sourceRows = getProjectVideoPresentationPilot(project)?.materials ?? project.materials ?? []
  const result = splitMaterialPreparation(mergeBrokenParenMaterials(sourceRows))
  const profile = getHouseholdProfile(project)
  // This source calls its suspended load 色素, although the steps and the
  // reviewed requirements identify a filled bottle or another counterweight.
  // Only the unchanged, qualified source may receive this contextual wording.
  let materials = result.materials
  let profileNotes = profile?.preparationNotes ?? []
  if (Number(project.id) === 791 && profile?.required.some((group) => group.includes('material-f5cea75922'))) {
    materials = materials.map((row) => row === '色素' ? '配重物（可用一瓶色素或其他配重物）'
      : row === '自备（双面胶、棉绳1.5米、厚方便袋、剪刀）' ? '自备（双面胶、棉绳1.5米、厚塑料袋、剪刀）' : row)
  }
  if (Number(project.id) === 354 && profile?.required.some((group) => group.includes('material-e6df1df966') && group.includes('material-2753766d18'))) {
    materials = materials.map((row) => row === '积木或方块若干' ? '积木若干' : row)
    profileNotes = profileNotes.map((note) => note.replace('准备可搭正方体/长方体的积木或方块；', '准备可搭正方体/长方体的积木；'))
  }
  return normalizeMaterialPresentation(materials, [
    ...result.preparationNotes, ...profileNotes, ...getProjectRevisionPreparationNotes(project),
  ])
}
