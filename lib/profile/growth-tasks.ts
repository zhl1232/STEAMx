import type { UserStats } from '@/lib/gamification/types'
import { MAINLINE_ENTRY_HREF } from '@/lib/product/mainline'

export const GROWTH_TASK_REWARD_ACTION_TYPE = 'profile_growth_task'
export const GROWTH_TASK_GRADUATION_ACTION_TYPE = 'profile_growth_task_graduation'
export const GROWTH_TASK_GRADUATION_RESOURCE_ID = 'v1'

export type GrowthTaskId =
  | 'start_first_lesson'
  | 'complete_first_lesson'
  | 'publish_first_work'
  | 'write_bio'
  | 'submit_first_observation'

export type GrowthTaskStatus = 'in_progress' | 'claimable' | 'claimed'

export type GrowthTaskProgressInput = {
  bio?: string | null
  lessonsStarted: number
  lessonsCompleted: number
  worksPublished: number
  observationsSubmitted: number
  consecutiveDays: number
}

type GrowthTaskDefinition = {
  id: GrowthTaskId
  label: string
  href: string
  rewardXp: number
  target: number
  getCurrentValue: (input: GrowthTaskProgressInput) => number
  getProgressLabel: (currentValue: number, done: boolean) => string
}

export type ProfileGrowthTask = {
  id: GrowthTaskId
  label: string
  href: string
  rewardXp: number
  reward: string
  target: number
  currentValue: number
  progressLabel: string
  progress: number
  done: boolean
  claimed: boolean
  claimable: boolean
  status: GrowthTaskStatus
}

/**
 * 顺序即主线：前三条是「挑一节积木课 → 跟 3D 分步搭完 → 拍照上传作品」，
 * 后两条是搭完之后顺手能做的补充动作。起步周计划直接消费这份定义，
 * 保证「这周要做的事」和「能领的奖励」是同一批对象。
 */
const GROWTH_TASK_DEFINITIONS: readonly GrowthTaskDefinition[] = [
  {
    id: 'start_first_lesson',
    label: '挑一节积木课打开看看',
    href: MAINLINE_ENTRY_HREF,
    rewardXp: 10,
    target: 1,
    getCurrentValue: (input) => input.lessonsStarted,
    getProgressLabel: (currentValue) => `${Math.min(currentValue, 1)}/1`,
  },
  {
    id: 'complete_first_lesson',
    label: '跟着 3D 分步搭完这一节',
    href: MAINLINE_ENTRY_HREF,
    rewardXp: 20,
    target: 1,
    getCurrentValue: (input) => input.lessonsCompleted,
    getProgressLabel: (currentValue) => `${Math.min(currentValue, 1)}/1`,
  },
  {
    id: 'publish_first_work',
    label: '拍张照，交出第一件作品',
    href: MAINLINE_ENTRY_HREF,
    rewardXp: 30,
    target: 1,
    getCurrentValue: (input) => input.worksPublished,
    getProgressLabel: (currentValue) => `${Math.min(currentValue, 1)}/1`,
  },
  {
    id: 'write_bio',
    label: '写一句自我介绍',
    href: '/settings/profile',
    rewardXp: 10,
    target: 1,
    getCurrentValue: (input) => (input.bio?.trim() ? 1 : 0),
    getProgressLabel: (_currentValue, done) => (done ? '已填写' : '待填写'),
  },
  {
    id: 'submit_first_observation',
    label: '记录 1 条自然观察',
    href: '/nature/submit',
    rewardXp: 10,
    target: 1,
    getCurrentValue: (input) => input.observationsSubmitted,
    getProgressLabel: (currentValue) => `${Math.min(currentValue, 1)}/1`,
  },
] as const

export const GROWTH_TASK_TOTAL = GROWTH_TASK_DEFINITIONS.length

function clampProgress(value: number, target: number) {
  if (target <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((value / target) * 100)))
}

export function getGrowthTaskDefinition(taskId: GrowthTaskId) {
  return GROWTH_TASK_DEFINITIONS.find((task) => task.id === taskId)
}

export function isGrowthTaskId(value: string): value is GrowthTaskId {
  return GROWTH_TASK_DEFINITIONS.some((task) => task.id === value)
}

/** Count distinct official growth task IDs present in xp_logs reward rows. */
export function countDistinctClaimedGrowthTaskRewards(
  rows: ReadonlyArray<{ resource_id: string | null }>,
): number {
  const ids = new Set<GrowthTaskId>()
  for (const row of rows) {
    if (row.resource_id && isGrowthTaskId(row.resource_id)) {
      ids.add(row.resource_id)
    }
  }
  return ids.size
}

export function isAllGrowthTasksClaimed(tasks: readonly ProfileGrowthTask[]) {
  return tasks.length > 0 && tasks.every((task) => task.claimed)
}

export function toGrowthTaskInput({
  bio,
  stats,
}: {
  bio?: string | null
  stats?: Partial<
    Pick<
      UserStats,
      | 'lessonsStarted'
      | 'lessonsCompleted'
      | 'worksPublished'
      | 'projectsCompleted'
      | 'observationsSubmitted'
      | 'consecutiveDays'
    >
  > | null
}): GrowthTaskProgressInput {
  // worksPublished 是 2026-08-14 迁移新增的统一口径；老快照没有这个字段时，
  // 退回只统计项目终稿的 projectsCompleted，不至于把已完成的用户打回未完成。
  const worksPublished = Number(stats?.worksPublished ?? stats?.projectsCompleted ?? 0)

  return {
    bio: bio ?? '',
    lessonsStarted: Number(stats?.lessonsStarted ?? 0),
    lessonsCompleted: Number(stats?.lessonsCompleted ?? 0),
    worksPublished,
    observationsSubmitted: Number(stats?.observationsSubmitted ?? 0),
    consecutiveDays: Number(stats?.consecutiveDays ?? 0),
  }
}

export function resolveGrowthTasks(
  input: GrowthTaskProgressInput,
  claimedTaskIds: ReadonlySet<GrowthTaskId> = new Set<GrowthTaskId>(),
): ProfileGrowthTask[] {
  return GROWTH_TASK_DEFINITIONS.map((task) => {
    const currentValue = Math.max(0, task.getCurrentValue(input))
    const done = currentValue >= task.target
    const claimed = claimedTaskIds.has(task.id)
    const claimable = done && !claimed
    const status: GrowthTaskStatus = claimed ? 'claimed' : claimable ? 'claimable' : 'in_progress'

    return {
      id: task.id,
      label: task.label,
      href: task.href,
      rewardXp: task.rewardXp,
      reward: `+${task.rewardXp} 经验`,
      target: task.target,
      currentValue,
      progressLabel: task.getProgressLabel(currentValue, done),
      progress: clampProgress(currentValue, task.target),
      done,
      claimed,
      claimable,
      status,
    }
  })
}

export function getCompletedGrowthTaskCount(tasks: readonly Pick<ProfileGrowthTask, 'done'>[]) {
  return tasks.filter((task) => task.done).length
}
