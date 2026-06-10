import type { TutorContextType, TutorGlobalSurface } from '@/lib/ai/tutor/types'

export type ResolvedTutorContext = {
  contextType: TutorContextType
  contextId: string
  stageIndex?: number
  /** Scratch 训练营：当前课时 id（课时学习页） */
  lessonId?: number
  /** global 场景：页面标识，决定小迪的开场白与场景上下文 */
  surface?: TutorGlobalSurface
}

export function resolveTutorContextFromPath(pathname: string): ResolvedTutorContext | null {
  if (
    pathname === '/login' ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/messages') ||
    pathname.startsWith('/share')
  ) {
    return null
  }

  const pblMatch = pathname.match(/^\/pbl\/(\d+)/)
  if (pblMatch) {
    return { contextType: 'challenge', contextId: pblMatch[1] }
  }

  const projectMatch = pathname.match(/^\/project\/(\d+)/)
  if (projectMatch) {
    return { contextType: 'project', contextId: projectMatch[1] }
  }

  const observationMatch = pathname.match(/^\/nature\/observations\/(\d+)/)
  if (observationMatch) {
    return { contextType: 'observation', contextId: observationMatch[1] }
  }

  const speciesMatch = pathname.match(/^\/nature\/species\/([^/]+)$/)
  if (speciesMatch) {
    return { contextType: 'species', contextId: decodeURIComponent(speciesMatch[1]) }
  }

  const lessonMatch = pathname.match(/^\/courses\/(\d+)\/lessons\/(\d+)/)
  if (lessonMatch) {
    return {
      contextType: 'course',
      contextId: lessonMatch[1],
      lessonId: Number.parseInt(lessonMatch[2], 10),
    }
  }

  const courseMatch = pathname.match(/^\/courses\/(\d+)/)
  if (courseMatch) {
    return { contextType: 'course', contextId: courseMatch[1] }
  }

  const surface = resolveGlobalSurface(pathname)
  if (surface) {
    return { contextType: 'global', contextId: '', surface }
  }

  return null
}

function resolveGlobalSurface(pathname: string): TutorGlobalSurface | null {
  if (pathname === '/') return 'home'
  if (pathname === '/explore' || pathname.startsWith('/explore/')) return 'explore'
  if (pathname === '/nature' || pathname.startsWith('/nature/')) return 'nature'
  if (pathname === '/create') return 'create'
  if (pathname === '/courses') return 'courses'
  if (pathname === '/community' || pathname.startsWith('/community/')) return 'community'
  if (pathname === '/playground') return 'playground'
  if (pathname.startsWith('/profile')) return 'profile'
  if (pathname.startsWith('/users/')) return 'users'
  return null
}

export function shouldShowGlobalTutor(pathname: string) {
  return resolveTutorContextFromPath(pathname) !== null
}
