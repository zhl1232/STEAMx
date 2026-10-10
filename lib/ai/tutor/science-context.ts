import { getScienceSample, isReviewedScienceProject } from '@/lib/project/science-samples'

/** Call only after the project's public approval gates have passed. Never include editorial metadata. */
export function getScienceTutorContent(id: number, title: string, category: string | null) {
  if (process.env.NODE_ENV !== 'development' && !isReviewedScienceProject(id)) return null
  const sample = getScienceSample(id)
  if (!sample || sample.title !== title || category !== '科学') return null
  return { mode: sample.mode ?? 'activity', demonstrationReason: sample.demonstrationReason, description: sample.description, materials: sample.materials, steps: sample.steps,
    extension: sample.extension, questions: sample.extensionQuestions ?? [], observation: sample.observation, principle: sample.principle, safety: sample.safety }
}
