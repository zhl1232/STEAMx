import {
  TUTOR_PLAYGROUND_GAME_KEYS,
  type TutorContextType,
  type TutorGlobalSurface,
  type TutorPlaygroundGameKey,
} from '@/lib/ai/tutor/types'

export type ResolvedTutorContext = {
  contextType: TutorContextType
  contextId: string
  stageIndex?: number
  /** 技能课程：当前课时 id（课时学习页） */
  lessonId?: number
  /** global 场景：页面标识，决定小迪的开场白与场景上下文 */
  surface?: TutorGlobalSurface
  /** playground surface：当前具体小游戏，避免不同游戏之间串上下文 */
  playgroundGameKey?: TutorPlaygroundGameKey
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
    const playgroundGameKey = surface === 'playground' ? resolvePlaygroundGameKey(pathname) : undefined
    return {
      contextType: 'global',
      contextId: playgroundGameKey ? `playground:${playgroundGameKey}` : '',
      surface,
      playgroundGameKey,
    }
  }

  return null
}

function resolvePlaygroundGameKey(pathname: string): TutorPlaygroundGameKey | undefined {
  const match = pathname.match(/^\/playground\/([^/]+)/)
  if (!match) return undefined
  const key = match[1]
  return TUTOR_PLAYGROUND_GAME_KEYS.includes(key as TutorPlaygroundGameKey)
    ? (key as TutorPlaygroundGameKey)
    : undefined
}

function resolveGlobalSurface(pathname: string): TutorGlobalSurface | null {
  if (pathname === '/') return 'home'
  if (pathname === '/explore' || pathname.startsWith('/explore/')) return 'explore'
  if (pathname === '/nature' || pathname.startsWith('/nature/')) return 'nature'
  if (pathname === '/create' || pathname === '/community' || pathname.startsWith('/community/')) return 'create'
  if (pathname === '/courses') return 'courses'
  if (pathname === '/playground' || pathname.startsWith('/playground/')) return 'playground'
  if (pathname.startsWith('/profile')) return 'profile'
  if (pathname.startsWith('/users/')) return 'users'
  return null
}

export function shouldShowGlobalTutor(pathname: string) {
  return resolveTutorContextFromPath(pathname) !== null
}
