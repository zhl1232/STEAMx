import { createHash } from 'node:crypto'
import type { Project } from '@/lib/mappers/types'
import { getScienceSampleForProject } from './science-samples'

/** Fingerprint the effective instructions before material presentation separates setup notes. */
export function hashProjectInstructionContent(project: Project): string {
  const sample = getScienceSampleForProject(project)
  return createHash('sha256').update(JSON.stringify([
    project.title,
    project.category,
    project.description ?? '',
    project.materials ?? [],
    (project.steps ?? []).map((step) => [step.title ?? '', step.description ?? '']),
    sample ? {
      mode: sample.mode ?? 'activity',
      instructionGap: sample.instructionGap ?? '',
      safety: sample.safety ?? '',
      sourceRelation: sample.sourceRelation ?? '',
      faq: sample.faq ?? [],
    } : null,
  ])).digest('hex')
}
