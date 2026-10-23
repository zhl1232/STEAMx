import type { Project } from '@/lib/mappers/types'
import profilesData from '@/lib/explore/household-projects.data.json'
import { hashProjectInstructionContent } from './content-fingerprint'

export { hashProjectInstructionContent as hashHouseholdProjectContent } from './content-fingerprint'

export type HouseholdProfile = {
  id: number
  title: string
  category: string
  contentHash: string
  required: string[][]
  preparationNotes?: string[]
}

// This module is server-side: only compact, validated requirements cross into cards.
const profiles = new Map((profilesData as HouseholdProfile[]).map((profile) => [profile.id, profile]))

/** Callers apply existing LED/science overrides first; stale content never inherits a profile. */
export function getHouseholdProfile(project: Project): HouseholdProfile | null {
  const profile = profiles.get(Number(project.id))
  if (!profile || project.title !== profile.title || project.category !== profile.category) return null
  return hashProjectInstructionContent(project) === profile.contentHash ? profile : null
}
