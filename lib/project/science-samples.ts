import type { Project } from '@/lib/mappers/types'
import samples from './science-samples.data.json'
import reviewedData from './science-reviewed.data.json'

export type ScienceSample = typeof samples[number] & { mode?: 'activity' | 'observation' | 'preparation'; instructionGap?: string; demonstrationReason?: string; sourceRelation?: 'alternative'; extensionQuestions?: string[] }
const reviewed = reviewedData as ScienceSample[]

/** Explicit release scope; other drafts are not included. */
export function isReviewedScienceProject(id: string | number): boolean {
  return reviewed.some(sample => sample.id === Number(id))
}

/** The released 55 share one content version in development and production. Legacy 59 retain their database guard. */
export function getScienceSample(id: string | number): ScienceSample | null {
  return reviewed.find(sample => sample.id === Number(id)) ?? samples.find(sample => sample.id === Number(id)) ?? null
}

export function scienceSampleIds(): number[] {
  return [...samples, ...reviewed].map(sample => sample.id)
}

export function getScienceSampleForProject(project: Project): ScienceSample | null {
  const sample = getScienceSample(project.id)
  if (!sample || project.title !== sample.title || project.category !== '科学') return null
  // Avoid showing newly released notes over stale or concurrently edited instructions.
  if (!isReviewedScienceProject(project.id) && process.env.NODE_ENV !== 'development' && (
    project.description !== sample.description ||
    JSON.stringify(project.materials) !== JSON.stringify(sample.materials) ||
    project.steps?.length !== sample.steps.length ||
    sample.steps.some((step, index) => {
      const actual = project.steps?.[index]
      return actual?.title !== step.title || actual?.description !== step.description
    })
  )) return null
  return sample
}

export function applyScienceSample(project: Project): Project {
  if (process.env.NODE_ENV !== 'development' && !isReviewedScienceProject(project.id)) return project
  const sample = getScienceSampleForProject(project)
  if (!sample) return project
  return {
    ...project,
    description: sample.description,
    materials: sample.materials,
    steps: sample.steps,
    reflection: sample.principle,
    ...(isReviewedScienceProject(project.id) ? { faq: sample.faq } : {}),
  }
}
