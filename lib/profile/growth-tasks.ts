import type { UserStats } from '@/lib/gamification/types'

export const GROWTH_TASK_REWARD_ACTION_TYPE = 'profile_growth_task'
export const GROWTH_TASK_GRADUATION_ACTION_TYPE = 'profile_growth_task_graduation'
export const GROWTH_TASK_GRADUATION_RESOURCE_ID = 'v1'

export type GrowthTaskId =
  | 'write_bio'
  | 'publish_first_project'
  | 'complete_first_project'
  | 'submit_first_observation'
  | 'explore_three_days'

export type GrowthTaskStatus = 'in_progress' | 'claimable' | 'claimed'

export type GrowthTaskProgressInput = {
  bio?: string | null
  projectsPublished: number
  projectsCompleted: number
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

const GROWTH_TASK_DEFINITIONS: readonly GrowthTaskDefinition[] = [
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
    id: 'publish_first_project',
    label: '发布 1 个项目',
    href: '/share',
    rewardXp: 20,
    target: 1,
    getCurrentValue: (input) => input.projectsPublished,
    getProgressLabel: (currentValue) => `${Math.min(currentValue, 1)}/1`,
  },
  {
    id: 'complete_first_project',
    label: '完成 1 个项目',
    href: '/profile/library',
    rewardXp: 20,
    target: 1,
    getCurrentValue: (input) => input.projectsCompleted,
    getProgressLabel: (currentValue) => `${Math.min(currentValue, 1)}/1`,
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
  {
    id: 'explore_three_days',
    label: '连续探索 3 天',
    href: '/profile',
    rewardXp: 20,
    target: 3,
    getCurrentValue: (input) => input.consecutiveDays,
    getProgressLabel: (currentValue) => `${Math.min(currentValue, 3)}/3`,
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
    Pick<UserStats, 'projectsPublished' | 'projectsCompleted' | 'observationsSubmitted' | 'consecutiveDays'>
  > | null
}): GrowthTaskProgressInput {
  return {
    bio: bio ?? '',
    projectsPublished: Number(stats?.projectsPublished ?? 0),
    projectsCompleted: Number(stats?.projectsCompleted ?? 0),
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
