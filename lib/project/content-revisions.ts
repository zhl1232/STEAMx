import type { Project } from '@/lib/mappers/types'
import revisionsData from './content-revisions.data.json'
import { hashProjectInstructionContent } from './content-fingerprint'

export type ProjectContentRevision = {
  id: number
  title: string
  category: string
  sourceHash: string
  contentHash: string
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
  const revision = revisions.get(Number(project.id))
  return revision && revision.title === project.title && revision.category === project.category
    && (!revision.sourceVideo || revision.sourceVideo.url === project.videoUrl) ? revision : null
}

/** Apply after established content overrides. Concurrent source edits invalidate this revision. */
export function applyProjectContentRevision(project: Project): Project {
  const revision = revisionForIdentity(project)
  if (!revision || hashProjectInstructionContent(project) !== revision.sourceHash) return project
  if (!revision.materials && !revision.steps) return project
  const revised = {
    ...project,
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

/** Setup notes are only shown alongside the exact corrected instructions. */
export function getProjectRevisionPreparationNotes(project: Project): string[] {
  const revision = revisionForIdentity(project)
  return revision && hashProjectInstructionContent(project) === revision.contentHash ? revision.preparationNotes ?? [] : []
}
