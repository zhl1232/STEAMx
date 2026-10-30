import type { Project } from '@/lib/mappers/types'
import { applyProjectContentRevision } from './content-revisions'
import { applyLedCardContent } from './led-card'
import { applyScienceSample } from './science-samples'
import { applyProjectDemonstration, applyProjectImageReview, preserveUnreviewedProjectCover } from './image-presentation'
import { resolveProjectVideoUrl } from './video-url'
import { applyProjectSourceTutorial, getProjectSourceTutorial } from './source-tutorials'

/** Source tutorials replace the complete copy; generated art still changes only the cover. */
export function applyEffectiveProjectDemonstration(project: Project, instructions: Project = project): Project {
  const sourceCover = preserveUnreviewedProjectCover(project, instructions)
  if (instructions.videoUrl?.trim() || resolveProjectVideoUrl(instructions)) return sourceCover
  const effective = applyProjectContentRevision(applyScienceSample(applyLedCardContent(instructions)))
  const candidate = applyProjectImageReview({ ...effective, image: instructions.image })
  if (getProjectSourceTutorial(candidate)) return applyProjectSourceTutorial({ ...sourceCover, ...candidate })
  const illustrated = applyProjectDemonstration(candidate)
  return illustrated.image !== candidate.image ? { ...sourceCover, image: illustrated.image } : sourceCover
}
