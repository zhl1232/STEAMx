import type { Project } from '@/lib/mappers/types'
import profilesData from './household-projects.data.json'
import { applyLedCardContent } from '@/lib/project/led-card'
import { resolveProjectMaterials } from '@/lib/project/materials'
import { getHouseholdProfile } from '@/lib/project/household-profile'
import { applyProjectContentRevision } from '@/lib/project/content-revisions'
import { applyScienceSample, getScienceSampleForProject } from '@/lib/project/science-samples'
import { isPlaceholderProjectStep } from '@/lib/seo/project-description'
import { validateMaterialRequirements } from './material-matching'

/** Explicit content-reviewed cohort; publication and viewer access are checked by the caller. */
export const HOUSEHOLD_PROJECT_IDS: readonly number[] = profilesData.map((profile) => profile.id)

/** Prepare effective database content; identities and every content dependency must still match. */
export function prepareHouseholdProject(project: Project): Project | null {
  const effective = applyProjectContentRevision(applyScienceSample(applyLedCardContent(project)))
  const profile = getHouseholdProfile(effective)
  if (!profile) return null
  const sample = getScienceSampleForProject(effective)
  if (sample && ((sample.mode !== undefined && sample.mode !== 'activity') || sample.instructionGap)) return null
  if (!effective.steps?.some((step) => step.description?.trim() && !isPlaceholderProjectStep(step))) return null

  const requirements = validateMaterialRequirements(profile.required)
  if (!requirements) return null
  const { materials } = resolveProjectMaterials(effective)
  if (materials.length === 0) return null
  return { ...effective, materials, householdRequirements: requirements }
}
