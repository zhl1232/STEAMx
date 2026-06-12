import type { ObservationEvent, Project } from '@/lib/mappers/types'
import type { NaturalObservationProgressSummary } from '@/lib/observations/progress'
import type { GrowthTaskId, ProfileGrowthTask } from '@/lib/profile/growth-tasks'
import type { ProfileTimelineEvent } from '@/lib/profile/timeline'
import type { SteamRadarWithGuidance } from '@/lib/profile/steam-radar'

export type ProfileNextActionVariant =
  | 'reward'
  | 'exploring'
  | 'growth'
  | 'radar'
  | 'nature'
  | 'vacuum'
  | 'timeline'
  | 'explore'

export type ProfileNextAction = {
  variant: ProfileNextActionVariant
  title: string
  subtitle: string
  href: string
  actionLabel: string
  badgeLabel: string
  secondaryHref?: string
  secondaryLabel?: string
  project?: Project
  growthTaskId?: GrowthTaskId
}

export type ProfileNextActionInput = {
  exploringProjects: Project[]
  steamRadar: SteamRadarWithGuidance | null
  myProjects: Project[]
  myObservations: ObservationEvent[]
  profileTimelineEvents: ProfileTimelineEvent[] | null
  growthTasks?: ProfileGrowthTask[]
  naturalObservationProgress?: NaturalObservationProgressSummary | null
}

export function isExploreVacuum(input: Pick<ProfileNextActionInput, 'steamRadar' | 'myProjects' | 'myObservations'>) {
  const hasRadarProgress = input.steamRadar
    ? Object.values(input.steamRadar).some((item) => (item?.display ?? 0) > 0)
    : false

  return !hasRadarProgress && input.myProjects.length === 0 && input.myObservations.length === 0
}

const STEAM_DIMENSIONS = [
  { key: 'S', label: '科学', category: '科学' },
  { key: 'T', label: '技术', category: '技术' },
  { key: 'E', label: '工程', category: '工程' },
  { key: 'A', label: '艺术', category: '艺术' },
  { key: 'M', label: '数学', category: '数学' },
] as const

function getWeakRadarDimension(steamRadar: SteamRadarWithGuidance | null) {
  if (!steamRadar) return null

  return STEAM_DIMENSIONS
    .map((dimension) => ({
      ...dimension,
      display: steamRadar[dimension.key]?.display ?? 0,
      guidance: steamRadar[dimension.key]?.guidance ?? null,
    }))
    .filter((dimension) => dimension.display < 75)
    .sort((a, b) => a.display - b.display)[0] ?? null
}

export function resolveProfileNextAction(input: ProfileNextActionInput): ProfileNextAction {
  const claimableTask = input.growthTasks?.find((task) => task.status === 'claimable')
  if (claimableTask) {
    return {
      variant: 'reward',
      title: claimableTask.label,
      subtitle: `${claimableTask.reward} 已达成，先把奖励收入成长档案。`,
      href: claimableTask.href,
      actionLabel: '领取奖励',
      badgeLabel: '可领取',
      growthTaskId: claimableTask.id,
    }
  }

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
      badgeLabel: '继续',
      secondaryHref: extraCount > 0 ? '/profile/library?tab=exploring' : undefined,
      secondaryLabel: extraCount > 0 ? '查看全部' : undefined,
      project: exploring,
    }
  }

  const growthTask = input.growthTasks?.find((task) => task.status === 'in_progress')
  if (growthTask) {
    return {
      variant: 'growth',
      title: growthTask.label,
      subtitle: `${growthTask.progressLabel} · 完成后获得 ${growthTask.reward}`,
      href: growthTask.href,
      actionLabel: '去完成',
      badgeLabel: '引导',
    }
  }

  if (isExploreVacuum(input)) {
    return {
      variant: 'vacuum',
      title: '从这里点亮你的探索档案',
      subtitle: '一次小实验、一张观察照片，都会让个人主页变成真正属于你的成长记录。',
      href: '/project',
      actionLabel: '发布第一个项目',
      badgeLabel: '起步',
      secondaryHref: '/nature/submit',
      secondaryLabel: '记录第一只鸟',
    }
  }

  const weakRadarDimension = getWeakRadarDimension(input.steamRadar)
  if (weakRadarDimension) {
    return {
      variant: 'radar',
      title: `${weakRadarDimension.label}能力补给`,
      subtitle: weakRadarDimension.guidance || `找一个${weakRadarDimension.label}项目补强你的能力雷达。`,
      href: `/explore?category=${encodeURIComponent(weakRadarDimension.category)}`,
      actionLabel: '去补强',
      badgeLabel: '补强',
    }
  }

  const allNatureProgress = input.naturalObservationProgress?.topicProgress.find((item) => item.topic === 'all')
  const unobservedPreview = input.naturalObservationProgress?.unobservedSpeciesPreview ?? []
  if (allNatureProgress && allNatureProgress.unobservedCount > 0) {
    const firstSpecies = unobservedPreview[0]
    return {
      variant: 'nature',
      title: firstSpecies ? `寻找${firstSpecies.commonName}` : '点亮一个待观察物种',
      subtitle: `物种清单还有 ${allNatureProgress.unobservedCount.toLocaleString('zh-CN')} 个待观察，去完成一次真实记录。`,
      href: '/nature/species?status=unobserved',
      actionLabel: '查看清单',
      badgeLabel: '观察',
      secondaryHref: '/nature/submit',
      secondaryLabel: '发布观察',
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
      badgeLabel: '回顾',
    }
  }

  return {
    variant: 'explore',
    title: '去发现新项目',
    subtitle: '浏览 STEAM 项目，找到下一个想动手完成的挑战。',
    href: '/explore',
    actionLabel: '去探索',
    badgeLabel: '推荐',
  }
}
