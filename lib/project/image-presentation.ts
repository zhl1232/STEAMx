import type { Project } from '@/lib/mappers/types'
import { getAssetsBaseUrl } from '@/lib/utils/asset-url'
import reviewsData from './image-reviews.data.json'
import demonstrationsData from './demonstration-images.data.json'
import { getSourceTutorialAsset } from './source-tutorials'

export const RUBBER_BAND_FAN_DIAGRAM = '/project-guides/rubber-band-fan-principle.svg'

type ProjectImageReview = {
  id: number
  title: string
  category: string
  covers: string[]
  stepImages: string[]
  replacementCover: string
  overview?: { steps: string[] }
}

const reviews = new Map((reviewsData as ProjectImageReview[]).map(review => [review.id, {
  ...review,
  covers: new Set(review.covers),
  stepImages: new Set(review.stepImages),
}]))
const replacementCovers = new Set((reviewsData as ProjectImageReview[]).map(review => review.replacementCover))

type ProjectDemonstration = {
  id: number
  title: string
  category: string
  image: string
  sourceImage: string
  description: string
  materials: string[]
  steps: { title: string; description: string }[]
  kind: 'demonstration' | 'principle'
}
type DemonstrationProject = Pick<Project, 'id' | 'title' | 'category' | 'image' | 'description' | 'materials' | 'steps' | 'videoUrl'>
const demonstrations = new Map((demonstrationsData as ProjectDemonstration[]).map(item => [item.id, item]))
const demonstrationImages = new Map((demonstrationsData as ProjectDemonstration[]).map(item => [item.image, item]))

/** The artwork is only valid for the complete instructions used to produce it. */
export function getProjectDemonstration(project: DemonstrationProject): ProjectDemonstration | null {
  const demonstration = demonstrations.get(Number(project.id))
  if (!demonstration || project.title !== demonstration.title || project.category !== demonstration.category
    || project.videoUrl?.trim() || project.description !== demonstration.description
    || !project.materials || !project.steps
    || JSON.stringify(project.materials) !== JSON.stringify(demonstration.materials)
    || JSON.stringify(project.steps.map(({ title, description }) => ({ title, description }))) !== JSON.stringify(demonstration.steps)
    || /https:\/\/[^\s<>"')\]]+?\.mp4/i.test([project.description, ...project.steps.map(step => step.description)].join('\n'))) return null
  const path = assetPath(project.image)
  const review = reviews.get(Number(project.id))
  const knownCover = review?.title === project.title && review.category === project.category
    && (review.covers.has(path) || path === review.replacementCover)
  return path === demonstration.image || path === assetPath(demonstration.sourceImage) || knownCover ? demonstration : null
}

export function applyProjectDemonstration<T extends DemonstrationProject>(project: T): T {
  const demonstration = getProjectDemonstration(project)
  return demonstration && project.image !== demonstration.image ? { ...project, image: demonstration.image } : project
}

/** Content overrides may change copy, but must not restore an older cover over a new upload. */
export function preserveUnreviewedProjectCover(project: Project, source: Project): Project {
  const review = reviews.get(Number(source.id))
  const demonstration = demonstrations.get(Number(source.id))
  const matches = (item: { title: string; category: string } | undefined) => item?.title === source.title && item.category === source.category
  const reviewedIdentity = matches(review)
  const illustratedIdentity = matches(demonstration)
  if (!reviewedIdentity && !illustratedIdentity) return project
  const path = assetPath(source.image)
  const known = (reviewedIdentity && (review!.covers.has(path) || path === review!.replacementCover))
    || (illustratedIdentity && (path === demonstration!.image || path === assetPath(demonstration!.sourceImage)))
  return known || project.image === source.image ? project : { ...project, image: source.image }
}

function assetPath(src: string): string {
  const path = src.trim().split(/[?#]/, 1)[0]
  if (path.startsWith('/api/assets/')) return path.slice('/api/assets'.length)
  const base = getAssetsBaseUrl()
  return base && path.startsWith(`${base}/`) ? path.slice(base.length) : path
}

/** Retire reviewed assets by identity and URL, independently of text revisions.
 * New photos survive; neither an ID-like filename nor absence of video is proof
 * that an unrelated project's illustrations are wrong.
 */
export function applyProjectImageReview<T extends Pick<Project, 'id' | 'title' | 'category' | 'image' | 'steps'>>(project: T): T {
  const review = reviews.get(Number(project.id))
  if (!review || project.title !== review.title || project.category !== review.category) return project
  const replaceCover = review.covers.has(assetPath(project.image))
  const hasRejectedSteps = project.steps?.some(step => step.image_url && review.stepImages.has(assetPath(step.image_url)))
  if (!replaceCover && !hasRejectedSteps) return project
  return {
    ...project,
    image: replaceCover ? review.replacementCover : project.image,
    ...(hasRejectedSteps ? {
      steps: project.steps?.map(step => step.image_url && review.stepImages.has(assetPath(step.image_url))
        ? { ...step, image_url: undefined }
        : step),
    } : {}),
  }
}

/** Keep provenance next to the image and in its full-screen caption. */
export function getProjectCoverPresentation(image: string): { notice?: string; fit: 'contain' | 'cover' } {
  const path = assetPath(image)
  if (getSourceTutorialAsset(path)) return { fit: 'contain' }
  const demonstration = demonstrationImages.get(path)
  if (demonstration) {
    return { notice: demonstration.kind === 'principle'
      ? '原理与结构示意，操作细节以正文为准。'
      : '生成演示图，具体操作见步骤说明。', fit: 'contain' }
  }
  if (path === RUBBER_BAND_FAN_DIAGRAM) {
    return { notice: '原理示意图，不是装配图。连接结构仍需核对。', fit: 'contain' }
  }
  if (replacementCovers.has(path)) {
    return { notice: '步骤概览，具体操作见下方说明。', fit: 'contain' }
  }
  if (/^\/projects\/corrections\/20260915-project-378-kaprekar-(?:four|three)-digit\.png$/.test(path)) {
    return { notice: '数值运算示意，计算时注意保留前导零。', fit: 'contain' }
  }
  if (/^\/projects\/generated\/project-\d+(?:-guide)?\.(?:webp|png|jpe?g)$/i.test(path)) {
    return { notice: '封面为生成示意图，不代表实物验证。', fit: 'cover' }
  }
  return { fit: 'cover' }
}
