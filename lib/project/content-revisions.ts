import type { Project } from '@/lib/mappers/types'
import revisionsData from './content-revisions.data.json'
import { hashProjectInstructionContent } from './content-fingerprint'
import { isSourceTutorialReplacement } from './source-tutorials'

export type ProjectContentRevision = {
  id: number
  title: string
  category: string
  sourceHash: string
  contentHash: string
  description?: string
  reflection?: string
  sourceReflection?: string | null
  sourceVideoUrl?: string | null
  presentation?: { mode: 'preparation'; stepsTitle: string; notice: string }
  materials?: string[]
  steps?: { title: string; description: string }[]
  preparationNotes?: string[]
  evidence: string[]
  sourceVideo?: {
    url: string
    sha256: string
    framesInspected: number
    timestamps: { overviewApproxSeconds: number[]; targetedExactSeconds: number[] }
    evidenceScope: string
  }
}

const revisions = new Map((revisionsData as ProjectContentRevision[]).map((revision) => [revision.id, revision]))

function revisionForIdentity(project: Project): ProjectContentRevision | null {
  if (isSourceTutorialReplacement(project)) return null
  const revision = revisions.get(Number(project.id))
  return revision && revision.title === project.title && revision.category === project.category
    && (revision.sourceVideoUrl === undefined || (revision.sourceVideoUrl === null
      ? !project.videoUrl : revision.sourceVideoUrl === project.videoUrl))
    && (!revision.sourceVideo || revision.sourceVideo.url === project.videoUrl) ? revision : null
}

/** Apply after established content overrides. Concurrent source edits invalidate this revision. */
export function applyProjectContentRevision(project: Project): Project {
  const revision = revisionForIdentity(project)
  if (!revision || hashProjectInstructionContent(project) !== revision.sourceHash) return project
  if (revision.sourceReflection !== undefined && (project.reflection ?? null) !== revision.sourceReflection) return project
  if (!revision.materials && !revision.steps && revision.description === undefined && revision.reflection === undefined) return project
  const revised = {
    ...project,
    ...(revision.description !== undefined ? { description: revision.description } : {}),
    ...(revision.reflection !== undefined ? { reflection: revision.reflection } : {}),
    ...(revision.materials ? { materials: revision.materials } : {}),
    ...(revision.steps ? {
      steps: revision.steps.map((step) => ({
        ...project.steps?.find((original) => original.title === step.title && original.description === step.description),
        ...step,
      })),
    } : {}),
  }
  return hashProjectInstructionContent(revised) === revision.contentHash ? revised : project
}

/** Preparation mode only belongs to the exact corrected project and its source video. */
export function getProjectRevisionPresentation(project: Project): ProjectContentRevision['presentation'] | null {
  const revision = revisionForIdentity(project)
  return revision && hashProjectInstructionContent(project) === revision.contentHash
    ? revision.presentation ?? null : null
}

/** Setup notes are only shown alongside the exact corrected instructions. */
export function getProjectRevisionPreparationNotes(project: Project): string[] {
  const revision = revisionForIdentity(project)
  return revision && hashProjectInstructionContent(project) === revision.contentHash ? revision.preparationNotes ?? [] : []
}
