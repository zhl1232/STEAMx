import type { SupabaseClient } from '@supabase/supabase-js'

import type { StudentProfileSnapshot } from '@/lib/ai/tutor/types'
import { BADGES } from '@/lib/gamification/badges'
import { buildPlaygroundUserStats } from '@/lib/gamification/playground-badges'
import type { UserStats } from '@/lib/gamification/types'
import { getAiCreditStatusForProfile } from '@/lib/api/ai-credits'
import type { MembershipProfile } from '@/lib/membership'
import {
  GROWTH_TASK_REWARD_ACTION_TYPE,
  GROWTH_TASK_TOTAL,
  resolveGrowthTasks,
  toGrowthTaskInput,
  type GrowthTaskId,
  type ProfileGrowthTask,
} from '@/lib/profile/growth-tasks'
import { logger } from '@/lib/logger'
import { sanitizeTutorUGC } from '@/lib/ai/tutor/untrusted-text'
import { getSteamRadarWithGuidanceSafe, type SteamRadarWithGuidance } from '@/lib/profile/steam-radar'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/types'
import { BoundedTtlMap } from '@/lib/utils/bounded-ttl-map'

/**
 * 进程内画像缓存（多实例部署评估结论，2026-08）：
 * 各实例独立失效重建，代价是同一用户最多每实例每 5 分钟多跑一次画像聚合查询；
 * 画像只是 tutor prompt 的背景摘要，无跨实例失效需求（invalidate 目前无调用方），
 * TTL 即新鲜度上界，多实例与单实例行为一致。因此当前不外置。
 * 外置触发条件：画像聚合查询在 DB 负载中占比显著，或出现「改完资料要求立刻生效」的产品需求；
 * 届时优先落 Redis（deployment 已有则直接换 BoundedTtlMap 为 Redis 读写），
 * 其次考虑 Supabase 缓存表（读 1 行替代 ~10 个聚合查询，写放大可接受）。
 */
const PROFILE_CACHE_MAX_ENTRIES = 1_000
const profileCache = new BoundedTtlMap<string, StudentProfileSnapshot>(PROFILE_CACHE_MAX_ENTRIES)
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000

const STEAM_LABELS: Record<string, string> = {
  S: '科学',
  T: '技术',
  E: '工程',
  A: '艺术',
  M: '数学',
}

const NATURE_TOPIC_LABELS: Record<string, string> = {
  birds: '鸟类',
  insects: '昆虫',
  plants: '植物',
  fungi: '真菌',
}

const RADAR_TIER_LABELS: Record<string, string> = {
  none: '待起步',
  foundation: '基础段',
  intermediate: '进阶段',
  challenge: '挑战段',
  expert: '高阶段',
}

function birthDateToAgeGroup(birthDate: string | null | undefined): string | null {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) return null
  const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  if (age < 10) return '6-9 岁'
  if (age < 13) return '10-12 岁'
  if (age < 16) return '13-15 岁'
  return '16+ 岁'
}

function levelFromXp(xp: number) {
  return Math.floor(Math.sqrt(xp / 100)) + 1
}

function compact(value: string, max = 120) {
  const text = value.trim()
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function uniqueNumbers(values: Array<number | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is number => typeof value === 'number')))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

type StatsRecord = Partial<UserStats> & Record<string, unknown>

function readStat(stats: StatsRecord | null, camelKey: keyof UserStats, legacyKey: string) {
  if (!stats) return 0
  return getNumber(stats[camelKey]) || getNumber(stats[legacyKey])
}

async function optionalProfileSignal(label: string, promise: Promise<string>) {
  try {
    return await promise
  } catch (error) {
    logger.warn('Failed to load optional tutor profile signal', {
      label,
      error,
    })
    return ''
  }
}

async function loadAiCreditSummary(
  supabase: SupabaseClient<Database>,
  profile: MembershipProfile | null,
) {
  const quota = await getAiCreditStatusForProfile(supabase, profile)
  return quota.isMember
    ? `AI 额度：会员代币余额 ${quota.walletBalance}，本月额度 ${quota.monthlyGrant}`
    : `AI 额度：今日免费剩余 ${quota.freeRemainingToday}/${quota.freeDaily} 次`
}

function formatRadarSummary(radar: SteamRadarWithGuidance | null) {
  if (!radar) return '暂无雷达数据'

  return Object.entries(STEAM_LABELS)
    .map(([key, label]) => {
      const item = radar[key]
      return `${label}${Math.round(item?.display ?? 0)}`
    })
    .join('、')
}

function formatRadarDetails(radar: SteamRadarWithGuidance | null) {
  if (!radar) return '能力雷达：当前没有可用数据'

  const scoreLines = Object.entries(STEAM_LABELS).map(([key, label]) => {
    const item = radar[key]
    const score = Math.round(item?.display ?? 0)
    const tier = RADAR_TIER_LABELS[item?.tier ?? 'none'] ?? '待起步'
    const guidance = item?.guidance ? `，建议：${compact(item.guidance, 48)}` : ''
    return `${label}${score}（${tier}${guidance}）`
  })

  return `能力雷达：${scoreLines.join('；')}`
}

export function buildStudentDataAccessSummary(input: {
  radar: SteamRadarWithGuidance | null
  statsSummary: string
  recentActivity: string
  learningSignalsSummary?: string
}) {
  return [
    '小迪当前可见的个人中心摘要：昵称、年龄段、等级/XP、加入天数、STEAM 能力雷达、累计统计、近期探索活动、成长任务、课程/PBL 进度、徽章、游乐场战绩、作品反馈和 AI 额度摘要。',
    formatRadarDetails(input.radar),
    `累计统计：${input.statsSummary}`,
    `近期活动：${input.recentActivity}`,
    input.learningSignalsSummary ? `学习信号：\n${input.learningSignalsSummary}` : null,
    '不可见：手机号、私信正文、账号安全设置、支付信息、精确生日、完整后台记录、管理员审核细节、完整操作日志、通知/私信全文、原始定位与未提供的其他隐私数据。',
  ].filter(Boolean).join('\n')
}

export function buildStudentLearningSignalsSummary(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join('\n')
}

function formatGrowthTaskSummary(tasks: readonly ProfileGrowthTask[], claimedKnown: boolean) {
  if (!tasks.length) return ''

  const doneCount = tasks.filter((task) => task.done).length
  const claimable = claimedKnown ? tasks.filter((task) => task.claimable).slice(0, 2) : []
  const nextTask = tasks.find((task) => !task.done)
  const details = [
    `成长任务：已完成 ${doneCount}/${GROWTH_TASK_TOTAL}`,
    claimable.length ? `可领取「${claimable.map((task) => task.label).join('」「')}」` : null,
    nextTask ? `下一项「${nextTask.label}」（${nextTask.progressLabel}）` : null,
  ].filter(Boolean)

  return details.join('；')
}

async function loadClaimedGrowthTaskIds(userId: string) {
  if (!supabaseAdmin) {
    return { ids: new Set<GrowthTaskId>(), available: false }
  }

  const { data, error } = await supabaseAdmin
    .from('xp_logs')
    .select('resource_id')
    .eq('user_id', userId)
    .eq('action_type', GROWTH_TASK_REWARD_ACTION_TYPE)

  if (error) throw error

  return {
    ids: new Set(
      ((data as { resource_id: string | null }[] | null) ?? [])
        .map((row) => row.resource_id)
        .filter((resourceId): resourceId is GrowthTaskId => Boolean(resourceId)),
    ),
    available: true,
  }
}

function formatBadgeSummary(rows: Array<{ badge_id: string; unlocked_at: string | null }>, totalCount?: number | null) {
  if (!rows.length && !totalCount) return ''

  const badgeNameById = new Map(BADGES.map((badge) => [badge.id, badge.name]))
  const recentNames = rows
    .map((row) => badgeNameById.get(row.badge_id) || row.badge_id)
    .filter(Boolean)
    .slice(0, 3)

  const countText = typeof totalCount === 'number' ? `已解锁 ${totalCount} 枚` : '已有徽章记录'
  return recentNames.length
    ? `徽章：${countText}，最近获得「${recentNames.join('」「')}」`
    : `徽章：${countText}`
}

async function loadBadgeSummary(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error, count } = await supabase
    .from('user_badges')
    .select('badge_id, unlocked_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false })
    .limit(5)

  if (error) throw error
  return formatBadgeSummary((data ?? []) as Array<{ badge_id: string; unlocked_at: string | null }>, count)
}

async function loadPlaygroundSummary(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from('playground_stats')
    .select('stats')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error

  const stats = buildPlaygroundUserStats(data?.stats ?? {})
  const details = [
    (stats.playgroundGamesPlayed ?? 0) > 0 ? `玩过 ${stats.playgroundGamesPlayed} 个小游戏` : null,
    (stats.playgroundWinsTotal ?? 0) > 0 ? `累计胜利/通关 ${stats.playgroundWinsTotal} 次` : null,
    stats.minesweeperWins > 0 ? `扫雷通关 ${stats.minesweeperWins} 次` : null,
    (stats.gomokuWins ?? 0) > 0 ? `五子棋胜 ${stats.gomokuWins} 局` : null,
    (stats.game2048MaxTile ?? 0) > 0 ? `2048 最高方块 ${stats.game2048MaxTile}` : null,
    (stats.quickMathBestStreak ?? 0) > 0 ? `速算最长连对 ${stats.quickMathBestStreak}` : null,
  ].filter(Boolean)

  return details.length ? `游乐场：${details.slice(0, 4).join('；')}` : ''
}

type LessonProgressSummaryRow = {
  completed_at: string | null
  updated_at: string
  course_lessons?: {
    title?: string | null
    courses?: {
      title?: string | null
      status?: string | null
    } | null
  } | null
}

function formatCourseProgressSummary(rows: LessonProgressSummaryRow[]) {
  const lines = rows
    .filter((row) => row.course_lessons?.courses?.status !== 'draft')
    .map((row) => {
      const lessonTitle = row.course_lessons?.title ? compact(row.course_lessons.title, 24) : ''
      const courseTitle = row.course_lessons?.courses?.title ? compact(row.course_lessons.courses.title, 24) : ''
      if (!lessonTitle) return null
      const status = row.completed_at ? '已学完' : '在学'
      return courseTitle ? `${status}《${courseTitle}》的「${lessonTitle}」` : `${status}「${lessonTitle}」`
    })
    .filter(Boolean)
    .slice(0, 3)

  return lines.length ? `课程进度：${lines.join('；')}` : ''
}

async function loadCourseProgressSummary(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from('user_lesson_progress')
    .select('completed_at, updated_at, course_lessons(title, courses(title, status))')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(5)

  if (error) throw error
  return formatCourseProgressSummary((data ?? []) as LessonProgressSummaryRow[])
}

function formatWorkFeedbackSummary(rows: Array<{ title: string | null; likes_count: number | null; comments_count: number | null }>) {
  const lines = rows
    .map((row) => {
      const title = sanitizeTutorUGC(row.title, 24) || '作品'
      const likes = getNumber(row.likes_count)
      const comments = getNumber(row.comments_count)
      if (likes <= 0 && comments <= 0) return `《${title}》已发布`
      return `《${title}》收到 ${likes} 个赞、${comments} 条评论`
    })
    .slice(0, 3)

  return lines.length ? `作品反馈：${lines.join('；')}` : ''
}

async function loadWorkFeedbackSummary(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('title, likes_count, comments_count')
    .eq('author_id', userId)
    .eq('status', 'approved')
    .order('updated_at', { ascending: false })
    .limit(3)

  if (error) throw error
  return formatWorkFeedbackSummary((data ?? []) as Array<{ title: string | null; likes_count: number | null; comments_count: number | null }>)
}

type ChallengeProgressRow = {
  challenge_id: number
  stage_index: number
  status: string | null
  updated_at: string | null
}

function getChallengeStageTitle(stages: unknown, index: number) {
  if (!Array.isArray(stages)) return `第 ${index + 1} 步`
  const stage = stages[index]
  if (!isRecord(stage)) return `第 ${index + 1} 步`
  const title = typeof stage.title === 'string' ? stage.title : ''
  return title ? compact(title, 30) : `第 ${index + 1} 步`
}

function formatChallengeProgressSummary(input: {
  participantIds: number[]
  challenges: Array<{ id: number; title: string | null; stages: unknown; status?: string | null }>
  progressRows: ChallengeProgressRow[]
  submittedChallengeIds: Set<number>
}) {
  const progressByChallenge = new Map<number, ChallengeProgressRow[]>()
  for (const row of input.progressRows) {
    const list = progressByChallenge.get(row.challenge_id) ?? []
    list.push(row)
    progressByChallenge.set(row.challenge_id, list)
  }

  const challengeById = new Map(input.challenges.map((challenge) => [challenge.id, challenge]))

  for (const challengeId of input.participantIds) {
    if (input.submittedChallengeIds.has(challengeId)) continue
    const challenge = challengeById.get(challengeId)
    if (!challenge || challenge.status === 'draft') continue

    const stages = Array.isArray(challenge.stages) ? challenge.stages : []
    const totalStages = stages.length
    if (totalStages === 0) continue

    const progress = progressByChallenge.get(challengeId) ?? []
    const completedIndexes = new Set(
      progress
        .filter((row) => row.status === 'completed')
        .map((row) => row.stage_index),
    )
    const nextStageIndex = stages.findIndex((_stage, index) => !completedIndexes.has(index))
    if (nextStageIndex < 0) continue

    return `PBL 进度：正在做《${compact(challenge.title || '项目挑战', 30)}》，已完成 ${completedIndexes.size}/${totalStages} 阶段，下一步「${getChallengeStageTitle(stages, nextStageIndex)}」`
  }

  return ''
}

async function loadChallengeProgressSummary(supabase: SupabaseClient<Database>, userId: string) {
  const { data: participants, error: participantsError } = await supabase
    .from('challenge_participants')
    .select('challenge_id, joined_at')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
    .limit(6)

  if (participantsError) throw participantsError

  const participantIds = uniqueNumbers(((participants as { challenge_id: number }[] | null) ?? []).map((row) => row.challenge_id))
  if (!participantIds.length) return ''

  const [challengesResponse, progressResponse, submissionsResponse] = await Promise.all([
    supabase.from('challenges').select('id, title, stages, status').in('id', participantIds),
    supabase
      .from('challenge_stage_progress')
      .select('challenge_id, stage_index, status, updated_at')
      .eq('user_id', userId)
      .in('challenge_id', participantIds)
      .order('updated_at', { ascending: false }),
    supabase
      .from('challenge_submissions')
      .select('challenge_id, status')
      .eq('user_id', userId)
      .in('challenge_id', participantIds),
  ])

  if (challengesResponse.error) throw challengesResponse.error
  if (progressResponse.error) throw progressResponse.error
  if (submissionsResponse.error) throw submissionsResponse.error

  const submittedChallengeIds = new Set(
    ((submissionsResponse.data as Array<{ challenge_id: number; status?: string | null }> | null) ?? [])
      .filter((row) => row.status === 'approved' || row.status === 'pending')
      .map((row) => row.challenge_id),
  )

  return formatChallengeProgressSummary({
    participantIds,
    challenges: (challengesResponse.data ?? []) as Array<{ id: number; title: string | null; stages: unknown; status?: string | null }>,
    progressRows: (progressResponse.data ?? []) as ChallengeProgressRow[],
    submittedChallengeIds,
  })
}

export function describeObservationActivity(
  natureTopic: string | null | undefined,
  locationName: string | null | undefined,
) {
  const topic = natureTopic ? NATURE_TOPIC_LABELS[natureTopic] ?? '自然' : '自然'
  const location = sanitizeTutorUGC(locationName, 20)
  return location ? `在${location}观察过${topic}` : `观察过${topic}`
}

export async function buildStudentProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<StudentProfileSnapshot> {
  const cached = profileCache.get(userId)
  if (cached) return cached

  const [
    profileResult,
    radar,
    statsResult,
    exploringResult,
    completionsResult,
    observationsResult,
    lessonsResult,
    claimedGrowthTasks,
    badgeSummary,
    playgroundSummary,
    courseProgressSummary,
    challengeProgressSummary,
    workFeedbackSummary,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, username, birth_date, xp, created_at, bio, membership_tier, membership_period, membership_started_at, membership_expires_at')
      .eq('id', userId)
      .maybeSingle(),
    getSteamRadarWithGuidanceSafe(supabase, userId, 'tutor-profile'),
    supabase.rpc('get_user_stats_summary', { target_user_id: userId } as never),
    supabase
      .from('project_explorations')
      .select('project_id, projects(title)')
      .eq('user_id', userId)
      .eq('status', 'exploring')
      .order('last_activity_at', { ascending: false })
      .limit(3),
    supabase
      .from('completed_projects')
      .select('completed_at, projects(title)')
      .eq('user_id', userId)
      .eq('record_kind', 'final')
      .eq('status', 'approved')
      .order('completed_at', { ascending: false })
      .limit(3),
    supabase
      .from('observation_events')
      .select('observed_at, location_name, nature_topic')
      .eq('user_id', userId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('user_lesson_progress')
      .select('updated_at, completed_at, course_lessons(title)')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(3),
    loadClaimedGrowthTaskIds(userId).catch((error) => {
      logger.warn('Failed to load claimed growth task ids for tutor profile', { userId, error })
      return { ids: new Set<GrowthTaskId>(), available: false }
    }),
    optionalProfileSignal('badges', loadBadgeSummary(supabase, userId)),
    optionalProfileSignal('playground', loadPlaygroundSummary(supabase, userId)),
    optionalProfileSignal('course-progress', loadCourseProgressSummary(supabase, userId)),
    optionalProfileSignal('challenge-progress', loadChallengeProgressSummary(supabase, userId)),
    optionalProfileSignal('work-feedback', loadWorkFeedbackSummary(supabase, userId)),
  ])

  const profile = profileResult.data
  // 昵称是学生可随意编辑的文本，会直接进入 system prompt，先做注入清洗。
  const displayName = sanitizeTutorUGC(profile?.display_name || profile?.username, 24) || '同学'
  const xp = profile?.xp ?? 0
  const level = levelFromXp(xp)
  const ageGroup = birthDateToAgeGroup(profile?.birth_date)
  const memberDays = profile?.created_at
    ? Math.max(1, Math.floor((Date.now() - Date.parse(profile.created_at)) / (24 * 60 * 60 * 1000)))
    : 0

  const radarSummary = formatRadarSummary(radar)

  const weakDim = radar
    ? Object.entries(STEAM_LABELS)
        .map(([key, label]) => ({ label, display: radar[key]?.display ?? 0 }))
        .sort((a, b) => a.display - b.display)[0]
    : null

  const stats = (statsResult.data ?? null) as StatsRecord | null
  const projectsCompleted = readStat(stats, 'projectsCompleted', 'completed_projects')
  const speciesObserved = readStat(stats, 'speciesObserved', 'observation_species_count')
  const challengesJoined = readStat(stats, 'challengesJoined', 'challenge_completions')
  const consecutiveDays = readStat(stats, 'consecutiveDays', 'login_streak')
  const statsSummary = stats
    ? [
        projectsCompleted ? `完成项目${projectsCompleted}个` : null,
        speciesObserved ? `观察物种${speciesObserved}种` : null,
        challengesJoined ? `参与挑战${challengesJoined}次` : null,
        consecutiveDays ? `连续登录${consecutiveDays}天` : null,
      ]
        .filter(Boolean)
        .join('；') || '还在积累探索记录'
    : '还在积累探索记录'

  const growthTaskSummary = formatGrowthTaskSummary(
    resolveGrowthTasks(
      toGrowthTaskInput({
        bio: profile?.bio ?? '',
        stats,
      }),
      claimedGrowthTasks.ids,
    ),
    claimedGrowthTasks.available,
  )
  const aiCreditSummary = await optionalProfileSignal('ai-credit', loadAiCreditSummary(supabase, profile))

  const exploringLines = (exploringResult.data ?? []).map((row) => {
    const project = row.projects as { title?: string } | null
    const title = sanitizeTutorUGC(project?.title, 30)
    return title ? `探索中《${title}》` : null
  }).filter(Boolean)

  const completionLines = (completionsResult.data ?? []).map((row) => {
    const project = row.projects as { title?: string } | null
    const title = sanitizeTutorUGC(project?.title, 30)
    return title ? `完成《${title}》` : null
  }).filter(Boolean)

  const observationLines = (observationsResult.data ?? []).map((row) => {
    return describeObservationActivity(
      row.nature_topic ? String(row.nature_topic) : null,
      row.location_name,
    )
  })

  const lessonLines = (lessonsResult.data ?? []).map((row) => {
    const lesson = row.course_lessons as { title?: string } | null
    if (!lesson?.title) return null
    return row.completed_at ? `学完《${compact(lesson.title, 30)}》` : `在学《${compact(lesson.title, 30)}》`
  }).filter(Boolean)

  const recentParts = [...exploringLines, ...completionLines, ...observationLines, ...lessonLines].slice(0, 5)
  const recentActivity = recentParts.length > 0 ? recentParts.join('；') : '最近还没有新的探索记录'
  const learningSignalsSummary = buildStudentLearningSignalsSummary([
    growthTaskSummary,
    courseProgressSummary,
    challengeProgressSummary,
    badgeSummary,
    playgroundSummary,
    workFeedbackSummary,
    aiCreditSummary,
  ])
  const dataAccessSummary = buildStudentDataAccessSummary({
    radar,
    statsSummary,
    recentActivity,
    learningSignalsSummary,
  })

  const text = [
    `昵称：${displayName}`,
    ageGroup ? `年龄段：${ageGroup}` : null,
    `等级 Lv.${level}（XP ${xp}），加入 ${memberDays} 天`,
    `STEAM 雷达：${radarSummary}${weakDim ? `，相对薄弱：${weakDim.label}` : ''}`,
    `累计：${statsSummary}`,
    `近期：${recentActivity}`,
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 400)

  const snapshot: StudentProfileSnapshot = {
    displayName,
    ageGroup,
    level,
    xp,
    memberDays,
    radarSummary,
    statsSummary,
    recentActivity,
    learningSignalsSummary,
    dataAccessSummary,
    text,
  }

  profileCache.set(userId, snapshot, Date.now() + PROFILE_CACHE_TTL_MS)
  return snapshot
}

export function invalidateStudentProfileCache(userId: string) {
  profileCache.delete(userId)
}
