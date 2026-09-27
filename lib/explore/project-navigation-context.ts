/**
 * Explore → project detail navigation context, kept in sessionStorage instead of
 * the URL. Project links stay parameter-free (`/project/123`) so crawlers never
 * see `?from=explore&sourceIndex=…` duplicates, while the detail page can still
 * (a) send "返回探索" back to the filtered explore list (which the scroll
 * restore in `explore-scroll-restore.ts` keys on) and (b) offer the next card of
 * that list as "继续看下一个项目".
 */
import type { Project } from '@/lib/mappers/types'

export const EXPLORE_PROJECT_CONTEXT_STORAGE_KEY = 'explore-project-context-v1'
const STORAGE_KEY = EXPLORE_PROJECT_CONTEXT_STORAGE_KEY
/** How many following explore cards travel with the context (for chained "next"). */
export const EXPLORE_CONTEXT_QUEUE_LIMIT = 24

export type ExploreContextProject = Pick<
  Project,
  'id' | 'title' | 'image' | 'description' | 'category' | 'sub_category' | 'author' | 'classification'
>

export type ExploreProjectContext = {
  /** Project the context was created for; other detail pages ignore it. */
  projectId: string
  /** Explore list URL including its filters, e.g. `/explore?tags=磁力`. */
  exploreHref: string
  /** Cards that followed the clicked one in the explore list, in order. */
  queue: ExploreContextProject[]
}

export function toExploreContextProject(project: Project | ExploreContextProject): ExploreContextProject {
  return {
    id: project.id,
    title: project.title,
    image: project.image,
    description: project.description,
    category: project.category,
    sub_category: project.sub_category,
    author: project.author,
    classification: project.classification ?? null,
  }
}

function isSafeExploreHref(value: unknown): value is string {
  return typeof value === 'string' && /^\/explore(?:[?#]|$)/.test(value) && !value.startsWith('//')
}

export function buildExploreProjectContext(
  projects: ReadonlyArray<Project | ExploreContextProject>,
  index: number,
  exploreHref: string,
): ExploreProjectContext | null {
  const current = projects[index]
  if (!current || !isSafeExploreHref(exploreHref)) return null
  return {
    projectId: String(current.id),
    exploreHref,
    queue: projects.slice(index + 1, index + 1 + EXPLORE_CONTEXT_QUEUE_LIMIT).map(toExploreContextProject),
  }
}

/** Context to hand to the next project when the user follows "继续看下一个项目". */
export function advanceExploreProjectContext(context: ExploreProjectContext): ExploreProjectContext | null {
  const [next, ...rest] = context.queue
  if (!next) return null
  return { projectId: String(next.id), exploreHref: context.exploreHref, queue: rest }
}

export function saveExploreProjectContext(context: ExploreProjectContext | null): void {
  if (typeof window === 'undefined') return
  try {
    if (context) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // sessionStorage may be unavailable (private mode quota, etc.)
  }
}

/** Raw sessionStorage value (stable string snapshot for `useSyncExternalStore`). */
export function readExploreProjectContextRaw(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function parseExploreProjectContext(
  raw: string | null,
  projectId: string | number,
): ExploreProjectContext | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ExploreProjectContext
    if (
      !parsed
      || typeof parsed.projectId !== 'string'
      || !isSafeExploreHref(parsed.exploreHref)
      || !Array.isArray(parsed.queue)
      || parsed.projectId !== String(projectId)
    ) {
      return null
    }
    const queue = parsed.queue.filter((item): item is ExploreContextProject =>
      Boolean(item) && (typeof item.id === 'string' || typeof item.id === 'number') && typeof item.title === 'string',
    )
    return { projectId: parsed.projectId, exploreHref: parsed.exploreHref, queue }
  } catch {
    return null
  }
}

export function readExploreProjectContext(projectId: string | number): ExploreProjectContext | null {
  return parseExploreProjectContext(readExploreProjectContextRaw(), projectId)
}
