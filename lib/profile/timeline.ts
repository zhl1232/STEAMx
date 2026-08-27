import { BADGES } from '@/lib/gamification/badges'
import {
  GROWTH_TASK_REWARD_ACTION_TYPE,
  getGrowthTaskDefinition,
  isGrowthTaskId,
} from '@/lib/profile/growth-tasks'
import { BRAND_FULL_NAME } from '@/lib/brand'

export const PROFILE_TIMELINE_TIME_ZONE = 'Asia/Shanghai'

export type ProfileTimelineIconName =
  | 'timeline'
  | 'projects'
  | 'observation'
  | 'achievement'
  | 'growth'

export type ProfileTimelineEventKind =
  | 'account_created'
  | 'project_published'
  | 'project_completed'
  | 'challenge_completed'
  | 'observation_submitted'
  | 'badge_unlocked'
  | 'xp_gained'

export type ProfileTimelineStatus = 'neutral' | 'pending' | 'approved' | 'rejected'

export type ProfileTimelineEvent = {
  id: string
  kind: ProfileTimelineEventKind
  occurredAt: string
  dateLabel: string
  fullDateLabel: string
  label: string
  detail: string
  href: string | null
  iconName: ProfileTimelineIconName
  status: ProfileTimelineStatus
  statusLabel?: string
  xpAmount?: number
}

export type ProjectTimelineRow = {
  id: string | number
  title?: string | null
  createdAt?: string | null
  status?: string | null
}

export type CompletedProjectTimelineRow = {
  id?: string | number | null
  projectId: string | number
  projectTitle?: string | null
  completedAt?: string | null
  status?: string | null
}

export type ChallengeSubmissionTimelineRow = {
  id: string | number
  challengeId: string | number
  challengeTitle?: string | null
  title?: string | null
  createdAt?: string | null
  status?: string | null
}

export type ObservationTimelineRow = {
  id: string | number
  title?: string | null
  habitat?: string | null
  observedAt?: string | null
  createdAt?: string | null
  status?: string | null
}

export type BadgeTimelineRow = {
  badgeId: string
  badgeName?: string | null
  unlockedAt?: string | null
}

export type XpLogTimelineRow = {
  id: string | number
  actionType: string
  resourceId?: string | number | null
  xpAmount: number
  createdAt?: string | null
}

export type BuildProfileTimelineInput = {
  accountCreatedAt?: string | null
  projects?: ProjectTimelineRow[]
  completedProjects?: CompletedProjectTimelineRow[]
  challengeSubmissions?: ChallengeSubmissionTimelineRow[]
  observations?: ObservationTimelineRow[]
  badges?: BadgeTimelineRow[]
  xpLogs?: XpLogTimelineRow[]
}

export type BuildProfileTimelineOptions = {
  before?: string | null
  limit?: number
  timeZone?: string
}

const BADGE_NAME_BY_ID = new Map(BADGES.map((badge) => [badge.id, badge.name]))

const EVENT_PRIORITY: Record<ProfileTimelineEventKind, number> = {
  badge_unlocked: 70,
  xp_gained: 60,
  project_completed: 50,
  challenge_completed: 50,
  observation_submitted: 45,
  project_published: 40,
  account_created: 10,
}

function parseTime(value?: string | null) {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : time
}

function datePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value || ''
}

export function formatProfileTimelineDateLabels(
  value: string,
  timeZone = PROFILE_TIMELINE_TIME_ZONE,
) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return {
      dateLabel: '未知',
      fullDateLabel: '未知时间',
    }
  }

  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const year = datePart(parts, 'year')
  const month = datePart(parts, 'month')
  const day = datePart(parts, 'day')
  const hour = datePart(parts, 'hour')
  const minute = datePart(parts, 'minute')

  return {
    dateLabel: `${Number(month)}.${day}`,
    fullDateLabel: `${year}/${month}/${day} ${hour}:${minute}`,
  }
}

function normalizeStatus(status?: string | null): ProfileTimelineStatus {
  if (status === 'pending' || status === 'approved' || status === 'rejected') {
    return status
  }

  return 'neutral'
}

function getStatusLabel(status: ProfileTimelineStatus) {
  if (status === 'pending') return '审核中'
  if (status === 'approved') return '已通过'
  if (status === 'rejected') return '未通过'
  return undefined
}

function getObservationTitle(row: ObservationTimelineRow) {
  if (row.title?.trim()) return row.title.trim()
  if (row.habitat?.trim()) return `${row.habitat.trim()}观察`
  return '自然观察记录'
}

function getChallengeLabel(status: ProfileTimelineStatus) {
  if (status === 'approved') return '完成挑战'
  if (status === 'rejected') return '挑战提交未通过'
  return '提交挑战'
}

function getCompletedProjectLabel(status: ProfileTimelineStatus) {
  if (status === 'approved' || status === 'neutral') return '完成项目'
  if (status === 'rejected') return '项目作品未通过'
  return '提交项目作品'
}

function getXpAttachmentKey(log: XpLogTimelineRow) {
  if (log.resourceId === null || log.resourceId === undefined || log.resourceId === '') return null

  const resourceId = String(log.resourceId)
  if (log.actionType === 'submit_observation') return `observation_submitted:${resourceId}`
  if (log.actionType === 'complete_project') return `project_completed:${resourceId}`
  if (log.actionType === 'complete_challenge' || log.actionType === 'challenge_participation') {
    return `challenge_completed:${resourceId}`
  }

  return null
}

function getStandaloneXpEvent(log: XpLogTimelineRow): Omit<ProfileTimelineEvent, 'dateLabel' | 'fullDateLabel'> | null {
  const occurredAt = log.createdAt
  if (!occurredAt || log.xpAmount <= 0) return null

  if (log.actionType === 'daily_login') {
    return {
      id: `xp:${log.id}`,
      kind: 'xp_gained',
      occurredAt,
      label: '经验提升',
      detail: '每日探索签到',
      href: '/profile',
      iconName: 'growth',
      status: 'neutral',
      xpAmount: log.xpAmount,
    }
  }

  if (log.actionType === GROWTH_TASK_REWARD_ACTION_TYPE) {
    const resourceId = String(log.resourceId || '')
    const task = isGrowthTaskId(resourceId) ? getGrowthTaskDefinition(resourceId) : null

    return {
      id: `xp:${log.id}`,
      kind: 'xp_gained',
      occurredAt,
      label: '新手引导奖励',
      detail: task?.label || '完成新手引导',
      href: task?.href || '/profile',
      iconName: 'growth',
      status: 'neutral',
      xpAmount: log.xpAmount,
    }
  }

  return null
}

function createEvent(
  event: Omit<ProfileTimelineEvent, 'dateLabel' | 'fullDateLabel'>,
  timeZone: string,
): ProfileTimelineEvent {
  return {
    ...event,
    ...formatProfileTimelineDateLabels(event.occurredAt, timeZone),
  }
}

function sortTimelineEvents(left: ProfileTimelineEvent, right: ProfileTimelineEvent) {
  const timeDiff = Date.parse(right.occurredAt) - Date.parse(left.occurredAt)
  if (timeDiff !== 0) return timeDiff

  const priorityDiff = EVENT_PRIORITY[right.kind] - EVENT_PRIORITY[left.kind]
  if (priorityDiff !== 0) return priorityDiff

  return left.id.localeCompare(right.id)
}

export function buildProfileTimelineEvents(
  input: BuildProfileTimelineInput,
  options: BuildProfileTimelineOptions = {},
): ProfileTimelineEvent[] {
  const timeZone = options.timeZone || PROFILE_TIMELINE_TIME_ZONE
  const beforeTime = parseTime(options.before)
  const events: ProfileTimelineEvent[] = []
  const attachedXpLogIds = new Set<string>()
  const xpByAttachmentKey = new Map<string, { amount: number; logIds: string[] }>()

  for (const log of input.xpLogs || []) {
    if (log.xpAmount <= 0) continue
    const key = getXpAttachmentKey(log)
    if (!key) continue

    const current = xpByAttachmentKey.get(key) || { amount: 0, logIds: [] }
    current.amount += log.xpAmount
    current.logIds.push(String(log.id))
    xpByAttachmentKey.set(key, current)
  }

  const addEvent = (event: Omit<ProfileTimelineEvent, 'dateLabel' | 'fullDateLabel'>) => {
    const occurredAtTime = parseTime(event.occurredAt)
    if (occurredAtTime === null) return
    if (beforeTime !== null && occurredAtTime >= beforeTime) return
    events.push(createEvent(event, timeZone))
  }

  const attachXp = (event: Omit<ProfileTimelineEvent, 'dateLabel' | 'fullDateLabel'>, key: string) => {
    const xp = xpByAttachmentKey.get(key)
    if (!xp) return event

    for (const logId of xp.logIds) {
      attachedXpLogIds.add(logId)
    }

    return {
      ...event,
      xpAmount: xp.amount,
    }
  }

  if (input.accountCreatedAt) {
    addEvent({
      id: 'account:created',
      kind: 'account_created',
      occurredAt: input.accountCreatedAt,
      label: '加入探索',
      detail: `开始在 ${BRAND_FULL_NAME} 记录探索`,
      href: '/profile',
      iconName: 'timeline',
      status: 'neutral',
    })
  }

  for (const project of input.projects || []) {
    if (!project.createdAt || project.status === 'draft') continue
    const status = normalizeStatus(project.status)
    addEvent({
      id: `project:published:${project.id}`,
      kind: 'project_published',
      occurredAt: project.createdAt,
      label: '发布作品',
      detail: project.title?.trim() || '新的项目作品',
      href: `/project/${project.id}`,
      iconName: 'projects',
      status,
      statusLabel: getStatusLabel(status),
    })
  }

  for (const completion of input.completedProjects || []) {
    if (!completion.completedAt) continue
    const status = normalizeStatus(completion.status)
    const event = attachXp(
      {
        id: `project:completed:${completion.id || completion.projectId}`,
        kind: 'project_completed',
        occurredAt: completion.completedAt,
        label: getCompletedProjectLabel(status),
        detail: completion.projectTitle?.trim() || '项目作品',
        href: `/project/${completion.projectId}`,
        iconName: 'projects',
        status,
        statusLabel: getStatusLabel(status),
      },
      `project_completed:${completion.projectId}`,
    )
    addEvent(event)
  }

  for (const submission of input.challengeSubmissions || []) {
    if (!submission.createdAt) continue
    const status = normalizeStatus(submission.status)
    const event = attachXp(
      {
        id: `challenge:submission:${submission.id}`,
        kind: 'challenge_completed',
        occurredAt: submission.createdAt,
        label: getChallengeLabel(status),
        detail: submission.challengeTitle?.trim() || submission.title?.trim() || '挑战作品',
        href: submission.challengeId ? `/pbl/${submission.challengeId}` : '/courses',
        iconName: 'achievement',
        status,
        statusLabel: getStatusLabel(status),
      },
      `challenge_completed:${submission.challengeId}`,
    )
    addEvent(event)
  }

  for (const observation of input.observations || []) {
    const occurredAt = observation.observedAt || observation.createdAt
    if (!occurredAt) continue
    const status = normalizeStatus(observation.status)
    const event = attachXp(
      {
        id: `observation:submitted:${observation.id}`,
        kind: 'observation_submitted',
        occurredAt,
        label: '自然观察',
        detail: getObservationTitle(observation),
        href: `/nature/observations/${observation.id}`,
        iconName: 'observation',
        status,
        statusLabel: getStatusLabel(status),
      },
      `observation_submitted:${observation.id}`,
    )
    addEvent(event)
  }

  for (const badge of input.badges || []) {
    if (!badge.unlockedAt) continue
    addEvent({
      id: `badge:${badge.badgeId}`,
      kind: 'badge_unlocked',
      occurredAt: badge.unlockedAt,
      label: '获得徽章',
      detail: badge.badgeName?.trim() || BADGE_NAME_BY_ID.get(badge.badgeId) || badge.badgeId,
      href: '/profile#profile-badges-anchor',
      iconName: 'achievement',
      status: 'neutral',
    })
  }

  for (const log of input.xpLogs || []) {
    if (attachedXpLogIds.has(String(log.id))) continue
    const standaloneEvent = getStandaloneXpEvent(log)
    if (standaloneEvent) {
      addEvent(standaloneEvent)
    }
  }

  const sortedEvents = events.sort(sortTimelineEvents)
  return options.limit ? sortedEvents.slice(0, options.limit) : sortedEvents
}
