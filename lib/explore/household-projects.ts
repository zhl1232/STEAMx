import type { Project } from '@/lib/mappers/types'
import { applyLedCardContent } from '@/lib/project/led-card'
import { resolveProjectMaterials } from '@/lib/project/materials'
import { applyScienceSample, getScienceSampleForProject, isReviewedScienceProject } from '@/lib/project/science-samples'
import { isPlaceholderProjectStep } from '@/lib/seo/project-description'
import { matchProjectMaterials } from './material-matching'

/** Explicit content-reviewed cohort; publication and viewer access are checked by the caller. */
export const HOUSEHOLD_PROJECT_IDS: readonly number[] = [586, 624, 717, 738, 745, 763, 812, 867, 1049, 1157]

/** Prepare mapped database content using the same effective source as project details. */
export function prepareHouseholdProject(project: Project): Project | null {
  if (!HOUSEHOLD_PROJECT_IDS.includes(Number(project.id)) || !isReviewedScienceProject(project.id)) return null

  const effective = applyScienceSample(applyLedCardContent(project))
  const sample = getScienceSampleForProject(effective)
  if (!sample || (sample.mode !== undefined && sample.mode !== 'activity') || sample.instructionGap) return null
  if (!effective.steps?.some((step) => step.description?.trim() && !isPlaceholderProjectStep(step))) return null

  const { materials } = resolveProjectMaterials(effective)
  if (!matchProjectMaterials(materials, [])) return null
  return { ...effective, materials }
}
