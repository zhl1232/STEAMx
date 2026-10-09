import type { Project } from '@/lib/mappers/types'
import samples from './science-samples.data.json'

export type ScienceSample = typeof samples[number]

/** Reviewed supplemental notes; production instructions are read from the database. */
export function getScienceSample(id: string | number): ScienceSample | null {
  return samples.find(sample => sample.id === Number(id)) ?? null
}

export function scienceSampleIds(): number[] {
  return samples.map(sample => sample.id)
}

export function getScienceSampleForProject(project: Project): ScienceSample | null {
  const sample = getScienceSample(project.id)
  if (!sample || project.title !== sample.title || project.category !== '科学') return null
  // Avoid showing newly released notes over stale or concurrently edited instructions.
  if (process.env.NODE_ENV !== 'development' && (
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
  if (process.env.NODE_ENV !== 'development') return project
  const sample = getScienceSampleForProject(project)
  if (!sample) return project
  return {
    ...project,
    description: sample.description,
    materials: sample.materials,
    steps: sample.steps,
    reflection: sample.principle,
  }
}
