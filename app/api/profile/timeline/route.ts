import { NextRequest, NextResponse } from 'next/server'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { loadObservationSpeciesForEvents } from '@/lib/api/nature-observation-data'
import { logger } from '@/lib/logger'
import {
  buildProfileTimelineEvents,
  type BadgeTimelineRow,
  type ChallengeSubmissionTimelineRow,
  type CompletedProjectTimelineRow,
  type ObservationTimelineRow,
  type ProjectTimelineRow,
  type XpLogTimelineRow,
} from '@/lib/profile/timeline'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

type ProjectRow = {
  id: number
  title: string | null
  created_at: string | null
  status?: string | null
}

type CompletionRow = {
  id?: number | null
  project_id: number
  completed_at: string | null
  status?: string | null
}

type ChallengeSubmissionRow = {
  id: number
  challenge_id: number
  title: string | null
  created_at: string | null
  status?: string | null
}

type ObservationRow = {
  id: number
  observed_at: string | null
  created_at?: string | null
  habitat?: string | null
  status?: string | null
}

type BadgeRow = {
  badge_id: string
  unlocked_at: string | null
}

type XpLogRow = {
  id: string | number
  action_type: string
  resource_id: string | null
  xp_amount: number
  created_at: string | null
}

function parseLimit(value: string | null) {
  if (!value) return DEFAULT_LIMIT
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT
  }

  return Math.min(MAX_LIMIT, parsed)
}

function parseBefore(value: string | null) {
  if (!value) return null
  const time = Date.parse(value)
  if (Number.isNaN(time)) {
    throw new Error('Invalid before cursor')
  }

  return new Date(time).toISOString()
}

function uniqueNumbers(values: Array<number | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is number => typeof value === 'number')))
}

async function loadProjectTitleMap(supabase: ServerSupabase, projectIds: number[]) {
  if (projectIds.length === 0) return new Map<number, string>()

  const { data, error } = await supabase
    .from('projects')
    .select('id, title')
    .in('id', projectIds)

  if (error) throw error

  return new Map(((data || []) as { id: number; title: string | null }[]).map((row) => [row.id, row.title || '项目作品']))
}

async function loadChallengeTitleMap(supabase: ServerSupabase, challengeIds: number[]) {
  if (challengeIds.length === 0) return new Map<number, string>()

  const { data, error } = await supabase
    .from('challenges')
    .select('id, title')
    .in('id', challengeIds)

  if (error) throw error

  return new Map(((data || []) as { id: number; title: string | null }[]).map((row) => [row.id, row.title || '挑战作品']))
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const limit = parseLimit(request.nextUrl.searchParams.get('limit'))
    const before = parseBefore(request.nextUrl.searchParams.get('before'))
    const sourceLimit = Math.min(200, Math.max(30, limit * 5))

    let projectsQuery = supabase
      .from('projects')
      .select('id, title, created_at, status')
      .eq('author_id', user.id)
      .order('created_at', { ascending: false })
      .limit(sourceLimit)
    if (before) {
      projectsQuery = projectsQuery.lt('created_at', before)
    }

    let completionsQuery = supabase
      .from('completed_projects')
      .select('id, project_id, completed_at, status, record_kind')
      .eq('user_id', user.id)
      .eq('record_kind', 'final')
      .order('completed_at', { ascending: false })
      .limit(sourceLimit)
    if (before) {
      completionsQuery = completionsQuery.lt('completed_at', before)
    }

    let challengeSubmissionsQuery = supabase
      .from('challenge_submissions')
      .select('id, challenge_id, title, created_at, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(sourceLimit)
    if (before) {
      challengeSubmissionsQuery = challengeSubmissionsQuery.lt('created_at', before)
    }

    let observationsQuery = supabase
      .from('observation_events')
      .select('id, observed_at, created_at, habitat, status')
      .eq('user_id', user.id)
      .order('observed_at', { ascending: false })
      .limit(sourceLimit)
    if (before) {
      observationsQuery = observationsQuery.lt('observed_at', before)
    }

    let badgesQuery = supabase
      .from('user_badges')
      .select('badge_id, unlocked_at')
      .eq('user_id', user.id)
      .order('unlocked_at', { ascending: false })
      .limit(sourceLimit)
    if (before) {
      badgesQuery = badgesQuery.lt('unlocked_at', before)
    }

    let xpLogsQuery = supabase
      .from('xp_logs')
      .select('id, action_type, resource_id, xp_amount, created_at')
      .eq('user_id', user.id)
      .gt('xp_amount', 0)
      .order('created_at', { ascending: false })
      .limit(sourceLimit)
    if (before) {
      xpLogsQuery = xpLogsQuery.lt('created_at', before)
    }

    const [
      projectsResponse,
      completionsResponse,
      challengeSubmissionsResponse,
      observationsResponse,
      badgesResponse,
      xpLogsResponse,
    ] = await Promise.all([
      projectsQuery,
      completionsQuery,
      challengeSubmissionsQuery,
      observationsQuery,
      badgesQuery,
      xpLogsQuery,
    ])

    if (projectsResponse.error) throw projectsResponse.error
    if (completionsResponse.error) throw completionsResponse.error
    if (challengeSubmissionsResponse.error) throw challengeSubmissionsResponse.error
    if (observationsResponse.error) throw observationsResponse.error
    if (badgesResponse.error) throw badgesResponse.error
    if (xpLogsResponse.error) throw xpLogsResponse.error

    const completionRows = ((completionsResponse.data || []) as CompletionRow[])
    const challengeSubmissionRows = ((challengeSubmissionsResponse.data || []) as ChallengeSubmissionRow[])
    const observationRows = ((observationsResponse.data || []) as ObservationRow[])
    const [projectTitleMap, challengeTitleMap, speciesByObservationId] = await Promise.all([
      loadProjectTitleMap(supabase, uniqueNumbers(completionRows.map((row) => row.project_id))),
      loadChallengeTitleMap(supabase, uniqueNumbers(challengeSubmissionRows.map((row) => row.challenge_id))),
      loadObservationSpeciesForEvents(observationRows.map((row) => row.id)),
    ])

    const projects: ProjectTimelineRow[] = ((projectsResponse.data || []) as ProjectRow[]).map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      status: row.status,
    }))

    const completedProjects: CompletedProjectTimelineRow[] = completionRows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      projectTitle: projectTitleMap.get(row.project_id),
      completedAt: row.completed_at,
      status: row.status,
    }))

    const challengeSubmissions: ChallengeSubmissionTimelineRow[] = challengeSubmissionRows.map((row) => ({
      id: row.id,
      challengeId: row.challenge_id,
      challengeTitle: challengeTitleMap.get(row.challenge_id),
      title: row.title,
      createdAt: row.created_at,
      status: row.status,
    }))

    const observations: ObservationTimelineRow[] = observationRows.map((row) => ({
      id: row.id,
      title: speciesByObservationId.get(row.id)?.[0]?.commonName,
      habitat: row.habitat,
      observedAt: row.observed_at,
      createdAt: row.created_at,
      status: row.status,
    }))

    const badges: BadgeTimelineRow[] = ((badgesResponse.data || []) as BadgeRow[]).map((row) => ({
      badgeId: row.badge_id,
      unlockedAt: row.unlocked_at,
    }))

    const xpLogs: XpLogTimelineRow[] = ((xpLogsResponse.data || []) as XpLogRow[]).map((row) => ({
      id: row.id,
      actionType: row.action_type,
      resourceId: row.resource_id,
      xpAmount: row.xp_amount,
      createdAt: row.created_at,
    }))

    const events = buildProfileTimelineEvents(
      {
        accountCreatedAt: user.created_at,
        projects,
        completedProjects,
        challengeSubmissions,
        observations,
        badges,
        xpLogs,
      },
      {
        before,
        limit: limit + 1,
      },
    )

    const visibleEvents = events.slice(0, limit)
    const lastEvent = visibleEvents[visibleEvents.length - 1]

    return NextResponse.json({
      events: visibleEvents,
      hasMore: events.length > limit,
      nextBefore: events.length > limit && lastEvent ? lastEvent.occurredAt : null,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid before cursor') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    logger.error('Error in GET /api/profile/timeline', { error })
    return handleApiError(error)
  }
}
