import type { Challenge, ObservationEvent, Project, StageProgress } from '@/lib/mappers/types'
import type { NaturalObservationProgressSummary } from '@/lib/observations/progress'
import type { GrowthTaskId, ProfileGrowthTask } from '@/lib/profile/growth-tasks'
import type { ProfileTimelineEvent } from '@/lib/profile/timeline'
import type { SteamRadarWithGuidance } from '@/lib/profile/steam-radar'
import { isExploreVacuum } from '@/lib/profile/next-action'

export type WeeklyPlanStepType =
  | 'reward'
  | 'pbl'
  | 'exploring'
  | 'course'
  | 'radar'
  | 'nature'
  | 'growth'
  | 'project'
  | 'challenge'
  | 'observation'
  | 'timeline'
  | 'explore'
  | 'playground'

export type WeeklyPlanStepStatus = 'todo' | 'done'

export type WeeklyPlanCourseProgress = {
  courseId: number
  courseTitle: string
  lessonId: number
  lessonTitle: string
  completedLessons: number
  totalLessons: number
  updatedAt?: string | null
}

export type WeeklyPlanPblProgress = {
  challenge: Pick<Challenge, 'id' | 'title' | 'image' | 'stages'>
  nextStageIndex: number
  nextStageTitle: string
  completedStages: number
  totalStages: number
  updatedAt?: string | null
  progress?: StageProgress[]
}

export type WeeklyPlanStep = {
  id: string
  type: WeeklyPlanStepType
  status: WeeklyPlanStepStatus
  title: string
  subtitle: string
  href: string
  actionLabel: string
  badgeLabel: string
  project?: Project
  growthTaskId?: GrowthTaskId
  occurredAt?: string
}

export type WeeklyPlan = {
  title: string
  subtitle: string
  weekStart: string
  completedCount: number
  steps: WeeklyPlanStep[]
}

export type BuildWeeklyPlanInput = {
  exploringProjects: Project[]
  steamRadar: SteamRadarWithGuidance | null
  myProjects: Project[]
  myObservations: ObservationEvent[]
  profileTimelineEvents: ProfileTimelineEvent[] | null
  growthTasks?: ProfileGrowthTask[]
  naturalObservationProgress?: NaturalObservationProgressSummary | null
  inProgressPbl?: WeeklyPlanPblProgress | null
  inProgressCourse?: WeeklyPlanCourseProgress | null
  now?: Date
}

const STEAM_DIMENSIONS = [
  { key: 'S', label: '科学', category: '科学' },
  { key: 'T', label: '技术', category: '技术' },
  { key: 'E', label: '工程', category: '工程' },
  { key: 'A', label: '艺术', category: '艺术' },
  { key: 'M', label: '数学', category: '数学' },
] as const

function asTimestamp(value?: string | null) {
  if (!value) return 0
  const time = Date.parse(value)
  return Number.isNaN(time) ? 0 : time
}

export function getWeeklyPlanWeekStart(now = new Date()): string {
  const shanghaiOffsetMs = 8 * 60 * 60 * 1000
  const shifted = new Date(now.getTime() + shanghaiOffsetMs)
  const day = shifted.getUTCDay() || 7
  shifted.setUTCHours(0, 0, 0, 0)
  shifted.setUTCDate(shifted.getUTCDate() - day + 1)
  return new Date(shifted.getTime() - shanghaiOffsetMs).toISOString()
}

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

function doneStepFromTimelineEvent(event: ProfileTimelineEvent): WeeklyPlanStep | null {
  const base = {
    status: 'done' as const,
    title: event.label,
    subtitle: event.detail || '本周已经完成一项探索',
    href: event.href || '/profile/timeline',
    actionLabel: '查看',
    occurredAt: event.occurredAt,
  }

  if (event.kind === 'project_completed' || event.kind === 'project_published') {
    return {
      ...base,
      id: `done:${event.id}`,
      type: 'project',
      badgeLabel: event.kind === 'project_published' ? '已发布' : '已完成',
    }
  }

  if (event.kind === 'challenge_completed') {
    return {
      ...base,
      id: `done:${event.id}`,
      type: 'challenge',
      badgeLabel: '挑战',
    }
  }

  if (event.kind === 'observation_submitted') {
    return {
      ...base,
      id: `done:${event.id}`,
      type: 'observation',
      badgeLabel: '观察',
    }
  }

  if (event.kind === 'badge_unlocked' || event.kind === 'xp_gained') {
    return {
      ...base,
      id: `done:${event.id}`,
      type: 'timeline',
      badgeLabel: event.kind === 'badge_unlocked' ? '徽章' : '经验',
    }
  }

  return null
}

function getDoneSteps(events: ProfileTimelineEvent[] | null, weekStart: string): WeeklyPlanStep[] {
  const threshold = asTimestamp(weekStart)
  return (events ?? [])
    .filter((event) => asTimestamp(event.occurredAt) >= threshold)
    .map(doneStepFromTimelineEvent)
    .filter((step): step is WeeklyPlanStep => Boolean(step))
    .sort((a, b) => asTimestamp(b.occurredAt) - asTimestamp(a.occurredAt))
    .slice(0, 3)
}

function buildTodoSteps(input: BuildWeeklyPlanInput): WeeklyPlanStep[] {
  const steps: WeeklyPlanStep[] = []
  const claimableTask = input.growthTasks?.find((task) => task.status === 'claimable')
  if (claimableTask) {
    steps.push({
      id: `todo:reward:${claimableTask.id}`,
      type: 'reward',
      status: 'todo',
      title: claimableTask.label,
      subtitle: `${claimableTask.reward} 已达成，先把奖励收入成长档案。`,
      href: claimableTask.href,
      actionLabel: '领取奖励',
      badgeLabel: '可领取',
      growthTaskId: claimableTask.id,
    })
  }

  if (input.inProgressPbl) {
    steps.push({
      id: `todo:pbl:${input.inProgressPbl.challenge.id}:${input.inProgressPbl.nextStageIndex}`,
      type: 'pbl',
      status: 'todo',
      title: input.inProgressPbl.nextStageTitle,
      subtitle: `继续《${input.inProgressPbl.challenge.title}》 · 已完成 ${input.inProgressPbl.completedStages}/${input.inProgressPbl.totalStages} 步`,
      href: `/pbl/${input.inProgressPbl.challenge.id}`,
      actionLabel: '继续挑战',
      badgeLabel: '项目挑战',
    })
  }

  const exploring = input.exploringProjects[0]
  if (exploring) {
    steps.push({
      id: `todo:exploring:${exploring.id}`,
      type: 'exploring',
      status: 'todo',
      title: exploring.title,
      subtitle:
        input.exploringProjects.length > 1
          ? `继续上次探索 · 还有 ${input.exploringProjects.length - 1} 个项目探索中`
          : '继续上次探索',
      href: `/project/${exploring.id}/records`,
      actionLabel: '继续探索',
      badgeLabel: '继续',
      project: exploring,
    })
  }

  if (input.inProgressCourse) {
    steps.push({
      id: `todo:course:${input.inProgressCourse.courseId}:${input.inProgressCourse.lessonId}`,
      type: 'course',
      status: 'todo',
      title: input.inProgressCourse.lessonTitle,
      subtitle: `继续《${input.inProgressCourse.courseTitle}》 · 已完成 ${input.inProgressCourse.completedLessons}/${input.inProgressCourse.totalLessons} 课`,
      href: `/courses/${input.inProgressCourse.courseId}/lessons/${input.inProgressCourse.lessonId}`,
      actionLabel: '继续课程',
      badgeLabel: '技能课程',
    })
  }

  const weakRadarDimension = getWeakRadarDimension(input.steamRadar)
  if (weakRadarDimension) {
    steps.push({
      id: `todo:radar:${weakRadarDimension.key}`,
      type: 'radar',
      status: 'todo',
      title: `${weakRadarDimension.label}能力补给`,
      subtitle: weakRadarDimension.guidance || `找一个${weakRadarDimension.label}项目补强你的能力雷达。`,
      href: `/explore?category=${encodeURIComponent(weakRadarDimension.category)}`,
      actionLabel: '去补强',
      badgeLabel: '补强',
    })
  }

  const allNatureProgress = input.naturalObservationProgress?.topicProgress.find((item) => item.topic === 'all')
  if (allNatureProgress && allNatureProgress.unobservedCount > 0) {
    const firstSpecies = input.naturalObservationProgress?.unobservedSpeciesPreview[0]
    steps.push({
      id: `todo:nature:${firstSpecies?.slug || 'all'}`,
      type: 'nature',
      status: 'todo',
      title: firstSpecies ? `寻找${firstSpecies.commonName}` : '点亮一个待观察物种',
      subtitle: `物种清单还有 ${allNatureProgress.unobservedCount.toLocaleString('zh-CN')} 个待观察，去完成一次真实记录。`,
      href: '/nature/species?status=unobserved',
      actionLabel: '查看清单',
      badgeLabel: '观察',
    })
  }

  const growthTask = input.growthTasks?.find((task) => task.status === 'in_progress')
  if (growthTask) {
    steps.push({
      id: `todo:growth:${growthTask.id}`,
      type: 'growth',
      status: 'todo',
      title: growthTask.label,
      subtitle: `${growthTask.progressLabel} · 完成后获得 ${growthTask.reward}`,
      href: growthTask.href,
      actionLabel: '去完成',
      badgeLabel: '引导',
      growthTaskId: growthTask.id,
    })
  }

  steps.push({
    id: 'todo:explore',
    type: 'explore',
    status: 'todo',
    title: '去发现新项目',
    subtitle: '浏览 STEAM 项目，找到下一个想动手完成的挑战。',
    href: '/explore',
    actionLabel: '去探索',
    badgeLabel: '推荐',
  })

  return steps
}

function buildStarterPlan(weekStart: string): WeeklyPlan {
  const steps: WeeklyPlanStep[] = [
    {
      id: 'starter:project',
      type: 'project',
      status: 'todo',
      title: '发布第一个项目',
      subtitle: '把一次小实验、小制作或 Scratch 作品记录下来。',
      href: '/share',
      actionLabel: '去发布',
      badgeLabel: '起步',
    },
    {
      id: 'starter:observation',
      type: 'observation',
      status: 'todo',
      title: '记录第一条自然观察',
      subtitle: '拍下身边的植物、昆虫或鸟类，点亮观察档案。',
      href: '/nature/submit',
      actionLabel: '去记录',
      badgeLabel: '观察',
    },
    {
      id: 'starter:playground',
      type: 'playground',
      status: 'todo',
      title: '逛逛益智游乐场',
      subtitle: '先玩一个小游戏，让主页拥有第一条探索痕迹。',
      href: '/playground',
      actionLabel: '去玩',
      badgeLabel: '热身',
    },
  ]

  return {
    title: '本周探索计划',
    subtitle: '先完成 3 个小动作，点亮你的成长档案。',
    weekStart,
    completedCount: 0,
    steps,
  }
}

export function buildWeeklyPlan(input: BuildWeeklyPlanInput): WeeklyPlan {
  const weekStart = getWeeklyPlanWeekStart(input.now)

  if (isExploreVacuum(input)) {
    return buildStarterPlan(weekStart)
  }

  const doneSteps = getDoneSteps(input.profileTimelineEvents, weekStart)
  const todoSteps = buildTodoSteps(input)
  const maxTotalSteps = 5
  const selectedDoneSteps = doneSteps.slice(0, 3)
  const todoSlots = maxTotalSteps - selectedDoneSteps.length
  const steps = [...selectedDoneSteps, ...todoSteps.slice(0, todoSlots)].slice(0, maxTotalSteps)
  const completedCount = steps.filter((step) => step.status === 'done').length

  return {
    title: '本周探索计划',
    subtitle:
      completedCount > 0
        ? '这周进展不错，继续完成下一步吧。'
        : '从最容易上手的一步开始吧。',
    weekStart,
    completedCount,
    steps,
  }
}

function stepProjectTag(step: WeeklyPlanStep) {
  if (!step.project) return null
  return `[project:${step.project.id}|${step.project.title}]`
}

export function formatWeeklyPlanForTutor(plan: WeeklyPlan): string {
  if (!plan.steps.length) return '本周探索计划暂时为空，可以先建议学生去探索页找一个感兴趣的项目。'

  const lines = plan.steps.map((step, index) => {
    const projectTag = stepProjectTag(step)
    const title = projectTag ?? step.title
    const status = step.status === 'done' ? '已完成' : '待完成'
    return `${index + 1}. ${status}｜${title}：${step.subtitle}（入口：${step.href}）`
  })

  return [
    `本周计划进度：${plan.completedCount}/${plan.steps.length}`,
    ...lines,
    '学生问下一步时，优先从第一个待完成步骤开始引导；如果引用站内项目，必须原样保留 [project:ID|标题] 格式。',
  ].join('\n')
}
