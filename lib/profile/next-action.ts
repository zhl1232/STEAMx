import type { ObservationEvent, Project } from '@/lib/mappers/types'
import type { ProfileTimelineEvent } from '@/lib/profile/timeline'
import type { SteamRadarWithGuidance } from '@/lib/profile/steam-radar'

export type ProfileNextActionVariant =
  | 'exploring'
  | 'vacuum'
  | 'timeline'
  | 'explore'

export type ProfileNextAction = {
  variant: ProfileNextActionVariant
  title: string
  subtitle: string
  href: string
  actionLabel: string
  secondaryHref?: string
  secondaryLabel?: string
  project?: Project
}

export type ProfileNextActionInput = {
  exploringProjects: Project[]
  steamRadar: SteamRadarWithGuidance | null
  myProjects: Project[]
  myObservations: ObservationEvent[]
  profileTimelineEvents: ProfileTimelineEvent[] | null
}

export function isExploreVacuum(input: Pick<ProfileNextActionInput, 'steamRadar' | 'myProjects' | 'myObservations'>) {
  return !input.steamRadar && input.myProjects.length === 0 && input.myObservations.length === 0
}

export function resolveProfileNextAction(input: ProfileNextActionInput): ProfileNextAction {
  const exploring = input.exploringProjects[0]

  if (exploring) {
    const extraCount = input.exploringProjects.length - 1
    return {
      variant: 'exploring',
      title: exploring.title,
      subtitle:
        extraCount > 0
          ? `继续上次探索 · 还有 ${extraCount} 个项目探索中`
          : '继续上次探索',
      href: `/project/${exploring.id}/records`,
      actionLabel: '继续探索',
      secondaryHref: extraCount > 0 ? '/profile/library?tab=exploring' : undefined,
      secondaryLabel: extraCount > 0 ? '查看全部' : undefined,
      project: exploring,
    }
  }

  if (isExploreVacuum(input)) {
    return {
      variant: 'vacuum',
      title: '从这里点亮你的探索档案',
      subtitle: '一次小实验、一张观察照片，都会让个人主页变成真正属于你的成长记录。',
      href: '/project',
      actionLabel: '发布第一个项目',
      secondaryHref: '/nature/submit',
      secondaryLabel: '记录第一只鸟',
    }
  }

  const events = input.profileTimelineEvents
  if (events && events.length > 0) {
    const latest = events[events.length - 1]
    return {
      variant: 'timeline',
      title: latest.label,
      subtitle: latest.detail || '查看你的最新探索动态',
      href: latest.href || '/profile/timeline',
      actionLabel: '查看详情',
    }
  }

  return {
    variant: 'explore',
    title: '去发现新项目',
    subtitle: '浏览 STEAM 项目，找到下一个想动手完成的挑战。',
    href: '/explore',
    actionLabel: '去探索',
  }
}
