import type { Project } from '@/lib/mappers/types'
import samples from './science-samples.data.json'

export type ScienceSample = typeof samples[number]

/** Review drafts only. Never override the shared production database or runtime. */
export function getScienceSample(id: string | number): ScienceSample | null {
  if (process.env.NODE_ENV !== 'development') return null
  return samples.find(sample => sample.id === Number(id)) ?? null
}

export function scienceSampleIds(): number[] {
  return process.env.NODE_ENV === 'development' ? samples.map(sample => sample.id) : []
}

export function getScienceSampleForProject(project: Pick<Project, 'id' | 'title' | 'category'>): ScienceSample | null {
  const sample = getScienceSample(project.id)
  return sample && project.title === sample.title && project.category === '科学' ? sample : null
}

export function applyScienceSample(project: Project): Project {
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
