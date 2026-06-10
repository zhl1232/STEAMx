import type { SupabaseClient } from '@supabase/supabase-js'

import type { StudentProfileSnapshot } from '@/lib/ai/tutor/types'
import { getSteamRadarWithGuidanceSafe } from '@/lib/profile/steam-radar'
import type { Database } from '@/lib/supabase/types'

type CacheEntry = { value: StudentProfileSnapshot; expiresAt: number }
const profileCache = new Map<string, CacheEntry>()
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000

const STEAM_LABELS: Record<string, string> = {
  S: '科学',
  T: '技术',
  E: '工程',
  A: '艺术',
  M: '数学',
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

export async function buildStudentProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<StudentProfileSnapshot> {
  const cached = profileCache.get(userId)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const [
    profileResult,
    radar,
    statsResult,
    exploringResult,
    completionsResult,
    observationsResult,
    lessonsResult,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, username, birth_date, xp, created_at')
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
  ])

  const profile = profileResult.data
  const displayName = profile?.display_name || profile?.username || '同学'
  const xp = profile?.xp ?? 0
  const level = levelFromXp(xp)
  const ageGroup = birthDateToAgeGroup(profile?.birth_date)
  const memberDays = profile?.created_at
    ? Math.max(1, Math.floor((Date.now() - Date.parse(profile.created_at)) / (24 * 60 * 60 * 1000)))
    : 0

  const radarSummary = radar
    ? Object.entries(STEAM_LABELS)
        .map(([key, label]) => {
          const item = radar[key]
          return `${label}${Math.round(item?.display ?? 0)}`
        })
        .join('、')
    : '暂无雷达数据'

  const weakDim = radar
    ? Object.entries(STEAM_LABELS)
        .map(([key, label]) => ({ label, display: radar[key]?.display ?? 0 }))
        .sort((a, b) => a.display - b.display)[0]
    : null

  const stats = (statsResult.data ?? null) as Record<string, number> | null
  const statsSummary = stats
    ? [
        stats.completed_projects ? `完成项目${stats.completed_projects}个` : null,
        stats.observation_species_count ? `观察物种${stats.observation_species_count}种` : null,
        stats.challenge_completions ? `完成挑战${stats.challenge_completions}次` : null,
        stats.login_streak ? `连续登录${stats.login_streak}天` : null,
      ]
        .filter(Boolean)
        .join('；') || '还在积累探索记录'
    : '还在积累探索记录'

  const exploringLines = (exploringResult.data ?? []).map((row) => {
    const project = row.projects as { title?: string } | null
    return project?.title ? `探索中《${compact(project.title, 30)}》` : null
  }).filter(Boolean)

  const completionLines = (completionsResult.data ?? []).map((row) => {
    const project = row.projects as { title?: string } | null
    return project?.title ? `完成《${compact(project.title, 30)}》` : null
  }).filter(Boolean)

  const observationLines = (observationsResult.data ?? []).map((row) => {
    const topic = row.nature_topic ? String(row.nature_topic) : '自然'
    return `观察${topic}${row.location_name ? `@${compact(row.location_name, 20)}` : ''}`
  })

  const lessonLines = (lessonsResult.data ?? []).map((row) => {
    const lesson = row.course_lessons as { title?: string } | null
    if (!lesson?.title) return null
    return row.completed_at ? `学完《${compact(lesson.title, 30)}》` : `在学《${compact(lesson.title, 30)}》`
  }).filter(Boolean)

  const recentParts = [...exploringLines, ...completionLines, ...observationLines, ...lessonLines].slice(0, 5)
  const recentActivity = recentParts.length > 0 ? recentParts.join('；') : '最近还没有新的探索记录'

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
    text,
  }

  profileCache.set(userId, { value: snapshot, expiresAt: Date.now() + PROFILE_CACHE_TTL_MS })
  return snapshot
}

export function invalidateStudentProfileCache(userId: string) {
  profileCache.delete(userId)
}
