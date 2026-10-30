import type { Project, ProjectStep } from '@/lib/mappers/types'
import { getAssetsBaseUrl } from '@/lib/utils/asset-url'
import tutorialsData from './source-tutorials.data.json'

export type SourceTutorialAsset = {
  image: string
  sourceImageUrl: string
  sourcePageUrl: string
  crop: { left: number; top: number; width: number; height: number; sourceWidth: number; sourceHeight: number }
  notes: string[]
  kind?: 'photo' | 'diagram'
  sha256?: string
  sourceSha256?: string
}

export type ProjectSourceTutorial = {
  id: number
  title: string
  category: string
  baseline: { description: string; materials: string[]; steps: Pick<ProjectStep, 'title' | 'description'>[]; covers: string[] }
  source: { title: string; url: string; publisher: string; accessedAt: string; author?: string; license?: string }
  replacement: { description: string; materials: string[]; steps: ProjectStep[]; reflection: string; image: string }
  assets: SourceTutorialAsset[]
  downloads?: { label: string; path: string }[]
}

function imagePath(image: string): string {
  const path = image.trim().split(/[?#]/, 1)[0]
  if (path.startsWith('/api/assets/')) return path.slice('/api/assets'.length)
  const base = getAssetsBaseUrl()
  return base && path.startsWith(`${base}/`) ? path.slice(base.length) : path
}

/** Crop coordinates refer to the downloaded original, before local encoding. */
export function isValidSourceTutorial(entry: ProjectSourceTutorial): boolean {
  try {
    const source = new URL(entry.source.url)
    if (!['https:', 'http:'].includes(source.protocol) || !entry.source.title || !entry.source.publisher) return false
    if (!entry.baseline.covers.length || !entry.replacement.materials.length || !entry.replacement.steps.length) return false
    if (entry.downloads?.some(file => !file.label || !file.path.startsWith('/project-guides/sources/') || /[?#\\]|\.\./.test(file.path))) return false
    const images = [entry.replacement.image, ...entry.replacement.steps.flatMap(step => step.image_url ? [step.image_url] : [])]
    if (!images.every(image => entry.assets.some(asset => asset.image === image))) return false
    return entry.assets.every(asset => {
      const { left, top, width, height, sourceWidth, sourceHeight } = asset.crop
      const original = new URL(asset.sourceImageUrl)
      return asset.image.startsWith('/') && !asset.image.startsWith('//')
        && ['http:', 'https:'].includes(original.protocol)
        && new URL(asset.sourcePageUrl).origin === source.origin
        && [left, top, width, height, sourceWidth, sourceHeight].every(Number.isInteger)
        && left >= 0 && top >= 0 && width > 0 && height > 0
        && left + width <= sourceWidth && top + height <= sourceHeight
    })
  } catch { return false }
}

const tutorials = (tutorialsData as ProjectSourceTutorial[]).filter(isValidSourceTutorial)
const byId = new Map(tutorials.map(entry => [entry.id, entry]))
const assets = new Map(tutorials.flatMap(entry => entry.assets.map(asset => [asset.image, asset] as const)))

type TutorialProject = Pick<Project, 'id' | 'title' | 'category' | 'description' | 'materials' | 'steps' | 'image' | 'videoUrl' | 'reflection'>

function hasVideo(project: TutorialProject): boolean {
  return Boolean(project.videoUrl?.trim()) || /https:\/\/[^\s<>"')\]]+?\.mp4/i.test(
    [project.description, ...project.steps?.map(step => step.description) ?? []].join('\n'),
  )
}

function matchesCopy(project: TutorialProject, copy: ProjectSourceTutorial['baseline'] | ProjectSourceTutorial['replacement']): boolean {
  return project.description === copy.description && Array.isArray(project.materials) && Array.isArray(project.steps)
    && JSON.stringify(project.materials) === JSON.stringify(copy.materials)
    && JSON.stringify(project.steps.map(({ title, description }) => ({ title, description })))
      === JSON.stringify(copy.steps.map(({ title, description }) => ({ title, description })))
}

/** An unrelated upload, source edit, partial projection or added video opts out. */
export function getProjectSourceTutorial(project: TutorialProject, entries?: readonly ProjectSourceTutorial[]): ProjectSourceTutorial | null {
  const entry = entries ? entries.find(item => item.id === Number(project.id) && isValidSourceTutorial(item)) : byId.get(Number(project.id))
  if (!entry || project.title !== entry.title || project.category !== entry.category || hasVideo(project)) return null
  const cover = imagePath(project.image)
  if (cover === imagePath(entry.replacement.image) && matchesCopy(project, entry.replacement)
    && project.reflection === entry.replacement.reflection
    && project.steps?.every((step, index) => step.image_url === entry.replacement.steps[index].image_url)) return entry
  return entry.baseline.covers.some(image => imagePath(image) === cover) && matchesCopy(project, entry.baseline) ? entry : null
}

export function applyProjectSourceTutorial<T extends Project>(project: T, entries?: readonly ProjectSourceTutorial[]): T {
  const entry = getProjectSourceTutorial(project, entries)
  if (!entry) return project
  return {
    ...project,
    ...entry.replacement,
    materials: [...entry.replacement.materials],
    steps: entry.replacement.steps.map(step => ({ ...step })),
    faq: undefined,
    problem_statement: undefined,
    householdRequirements: undefined,
    classification: null,
  }
}

/** Only an already replaced project suppresses the old standalone revision notes. */
export function isSourceTutorialReplacement(project: TutorialProject): boolean {
  const entry = getProjectSourceTutorial(project)
  return Boolean(entry && imagePath(project.image) === imagePath(entry.replacement.image) && matchesCopy(project, entry.replacement))
}

export function getSourceTutorialAsset(image: string): SourceTutorialAsset | null {
  return assets.get(imagePath(image)) ?? null
}

/** Bounded candidates only; callers must still validate each current database row. */
export function getSourceTutorialProjectIds(): number[] {
  return [...byId.keys()]
}
