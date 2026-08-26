import { cache } from 'react'

import { logger } from '@/lib/logger'
import { mapDbChallenge, type Challenge } from '@/lib/mappers/types'
import { createClient, createPublicClient } from '@/lib/supabase/server'
import { getContentClassificationSettings, withoutPublicClassification } from '@/lib/content-classification'

export interface ChallengeGroups {
  activeTimed: Challenge[]
  evergreen: Challenge[]
  ended: Challenge[]
}

export type FeaturedPblChallenge = {
  id: number
  title: string
  summary: string
  imageUrl: string
}

type FeaturedChallengeRow = {
  id: number
  title: string
  description: string | null
  image_url: string | null
  challenge_type: string | null
}

export function pickFeaturedPblChallenge(rows: FeaturedChallengeRow[]): FeaturedPblChallenge | null {
  if (rows.length === 0) return null

  const featured = rows.find((row) => row.challenge_type === 'timed')
    ?? rows.find((row) => row.challenge_type === 'evergreen')
    ?? rows[0]
  const summary = (featured.description || '').replace(/\s+/g, ' ').trim()

  return {
    id: featured.id,
    title: featured.title,
    summary: summary || '每周开放 · 记录探索过程，提交作品',
    imageUrl: featured.image_url || '',
  }
}

export async function getFeaturedPblChallenge(): Promise<FeaturedPblChallenge | null> {
  const supabase = createPublicClient()
  const classificationSettings = await getContentClassificationSettings()

  try {
    let challengeQuery = supabase
      .from('challenges')
      .select('id, title, description, image_url, challenge_type')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (classificationSettings.enforcementEnabled) {
      challengeQuery = challengeQuery.eq('classification_status', 'reviewed')
    }
    const { data, error } = await challengeQuery.limit(20)

    if (error) throw error
    return pickFeaturedPblChallenge((data || []) as FeaturedChallengeRow[])
  } catch (error) {
    logger.error('Error fetching featured PBL challenge', { error })
    return null
  }
}

export type PublicPblChallenge = {
  id: number
  title: string
  description: string
  imageUrl: string
  status: 'active' | 'ended'
  challengeType: 'timed' | 'evergreen'
  tags: string[]
  classification?: Challenge['classification']
}

/**
 * 读取公开挑战的稳定摘要，供挑战详情的服务端 metadata 和存在性检查共用。
 * 用户参与状态仍由详情页 API 在客户端按登录态补充。
 */
export const getPublicPblChallenge = cache(async function getPublicPblChallenge(
  challengeId: number,
): Promise<PublicPblChallenge | null> {
  if (!Number.isInteger(challengeId) || challengeId <= 0) return null

  const supabase = createPublicClient()
  const classificationSettings = await getContentClassificationSettings()
  const includeClassification = classificationSettings.publicV1Enabled || classificationSettings.enforcementEnabled
  let challengeQuery = supabase
    .from('challenges')
    .select(`id, title, description, image_url, status, challenge_type, tags${includeClassification ? ', recommended_min_age, recommended_max_age, support_level, classification_status, classification_source, classification_reviewed_at, classification_reviewed_by, classification_revision' : ''}`)
    .eq('id', challengeId)
    .in('status', ['active', 'ended'])
  if (classificationSettings.enforcementEnabled) {
    challengeQuery = challengeQuery.eq('classification_status', 'reviewed')
  }
  const { data, error } = await challengeQuery.maybeSingle()

  if (error) {
    logger.error('Error fetching public PBL challenge', { error, challengeId })
    return null
  }

  if (!data) return null

  // Dynamic selects are useful while the phase-1 columns are still optional,
  // but PostgREST's type parser cannot represent the interpolated string.
  // Keep the boundary explicit and let the mapper validate the optional fields.
  const row = data as unknown as {
    id: number
    title: string
    description: string | null
    image_url: string | null
    status: string
    challenge_type: string
    tags: string[] | null
  }
  const mapped = mapDbChallenge(data as never)
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    imageUrl: row.image_url || '',
    status: row.status as PublicPblChallenge['status'],
    challengeType: row.challenge_type as PublicPblChallenge['challengeType'],
    tags: row.tags || [],
    ...(classificationSettings.publicV1Enabled ? { classification: mapped.classification } : {}),
  }
})

export const emptyChallengeGroups: ChallengeGroups = {
  activeTimed: [],
  evergreen: [],
  ended: [],
}

const PBL_CHALLENGE_SELECT = [
  'id',
  'title',
  'description',
  'image_url',
  'participants_count',
  'start_date',
  'end_date',
  'tags',
  'challenge_type',
  'status',
  'difficulty_stars',
  'created_at',
].join(',')

export async function getPblChallengeGroups(): Promise<{
  challenges: ChallengeGroups
  error: string | null
  userId: string | null
}> {
  const supabase = await createClient()

  try {
    const classificationSettings = await getContentClassificationSettings()
    const includeClassification = classificationSettings.publicV1Enabled || classificationSettings.enforcementEnabled
    const challengeSelect = includeClassification
      ? `${PBL_CHALLENGE_SELECT}, recommended_min_age, recommended_max_age, support_level, classification_status, classification_source, classification_reviewed_at, classification_reviewed_by, classification_revision`
      : PBL_CHALLENGE_SELECT
    let challengeQuery = supabase
      .from('challenges')
      .select(challengeSelect)
      .in('status', ['active', 'ended'])
      .order('created_at', { ascending: false })
      .limit(50)
    if (classificationSettings.enforcementEnabled) {
      challengeQuery = challengeQuery.eq('classification_status', 'reviewed')
    }

    const [{ data: challengeRows, error: challengeError }, { data: { user } }] = await Promise.all([
      challengeQuery,
      supabase.auth.getUser(),
    ])

    if (challengeError) throw challengeError

    let joinedIds = new Set<number>()
    let approvedSubmissionIds = new Set<number>()
    const mySubmissionStatusByChallenge = new Map<number, string>()
    const challengeIds = (((challengeRows || []) as unknown) as { id: number }[]).map((row) => row.id)
    const submissionsCountByChallenge = new Map<number, number>()

    const submissionCountPromise = challengeIds.length > 0
      ? supabase
          .from('challenge_submissions')
          .select('challenge_id')
          .in('challenge_id', challengeIds)
          .eq('status', 'approved')
          .eq('is_public', true)
          .eq('moderation_state', 'approved')
      : Promise.resolve({ data: [], error: null })

    const userStatePromise = user
      ? Promise.all([
          supabase.from('challenge_participants').select('challenge_id').eq('user_id', user.id),
          supabase.from('challenge_submissions').select('challenge_id, status').eq('user_id', user.id),
        ])
      : Promise.resolve(null)

    const [submissionCountResult, userStateResult] = await Promise.all([
      submissionCountPromise,
      userStatePromise,
    ])

    if (submissionCountResult.error) {
      logger.error('Error counting challenge submissions', { error: submissionCountResult.error })
    }

    for (const row of (submissionCountResult.data || []) as { challenge_id: number }[]) {
      submissionsCountByChallenge.set(
        row.challenge_id,
        (submissionsCountByChallenge.get(row.challenge_id) || 0) + 1,
      )
    }

    if (userStateResult) {
      const [{ data: participants }, { data: submissions }] = userStateResult
      joinedIds = new Set(((participants || []) as { challenge_id: number }[]).map((row) => row.challenge_id))

      for (const row of (submissions || []) as { challenge_id: number; status: string }[]) {
        mySubmissionStatusByChallenge.set(row.challenge_id, row.status)
      }

      approvedSubmissionIds = new Set(
        ((submissions || []) as { challenge_id: number; status: string }[])
          .filter((row) => row.status === 'approved')
          .map((row) => row.challenge_id),
      )
    }

    const rows = ((challengeRows || []) as unknown) as Record<string, unknown>[]
    const mapChallenge = (row: Record<string, unknown>) => {
      const mapped = mapDbChallenge({
        ...row,
        submissions_count: submissionsCountByChallenge.get(row.id as number) || 0,
        my_submission_status: mySubmissionStatusByChallenge.get(row.id as number),
      } as never, joinedIds.has(row.id as number), approvedSubmissionIds.has(row.id as number))

      return classificationSettings.publicV1Enabled
        ? mapped
        : (withoutPublicClassification(mapped) as Challenge)
    }

    return {
      challenges: {
        activeTimed: rows
          .filter((row) => row.challenge_type === 'timed' && row.status === 'active')
          .map(mapChallenge),
        evergreen: rows
          .filter((row) => row.challenge_type === 'evergreen' && row.status === 'active')
          .map(mapChallenge),
        ended: rows
          .filter((row) => row.status === 'ended')
          .map(mapChallenge),
      },
      error: null,
      userId: user?.id ?? null,
    }
  } catch (error) {
    logger.error('Error fetching PBL challenges', { error })
    return {
      challenges: emptyChallengeGroups,
      error: '挑战加载失败，请稍后重试',
      userId: null,
    }
  }
}
