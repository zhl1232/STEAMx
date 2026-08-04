import type { SupabaseClient } from '@supabase/supabase-js'

import { mapDbChallengeSubmission, type ChallengeSubmission, type ChallengeSubmissionRatingSummary, type ObservationLinkedItem } from '@/lib/mappers/types'
import type { Database } from '@/lib/supabase/types'

type ServerSupabase = SupabaseClient<Database>

type RatingRow = Database['public']['Tables']['challenge_submission_ratings']['Row']
type SubmissionRow = Database['public']['Tables']['challenge_submissions']['Row']

function summarizeRatings(rows: RatingRow[]): ChallengeSubmissionRatingSummary {
  const count = rows.length
  if (count === 0) {
    return {
      avgCreativeExpression: 0,
      avgCompletionQuality: 0,
      avgEvidenceCompleteness: 0,
      avgReflectionDepth: 0,
      avgScore: 0,
      ratingCount: 0,
    }
  }

  const avgCreativeExpression = Math.round(rows.reduce((sum, row) => sum + row.creative_expression, 0) / count * 100) / 100
  const avgCompletionQuality = Math.round(rows.reduce((sum, row) => sum + row.completion_quality, 0) / count * 100) / 100
  const avgEvidenceCompleteness = Math.round(rows.reduce((sum, row) => sum + row.evidence_completeness, 0) / count * 100) / 100
  const avgReflectionDepth = Math.round(rows.reduce((sum, row) => sum + row.reflection_depth, 0) / count * 100) / 100
  const avgScore = Math.round(((avgCreativeExpression + avgCompletionQuality + avgEvidenceCompleteness + avgReflectionDepth) / 4) * 100) / 100

  return {
    avgCreativeExpression,
    avgCompletionQuality,
    avgEvidenceCompleteness,
    avgReflectionDepth,
    avgScore,
    ratingCount: count,
  }
}

async function loadReferenceProjects(
  supabase: ServerSupabase,
  submissionIds: number[],
): Promise<Map<number, ObservationLinkedItem[]>> {
  if (submissionIds.length === 0) {
    return new Map()
  }

  const { data, error } = await supabase
    .from('challenge_submission_projects')
    .select('submission_id, project_id, sort_order')
    .in('submission_id', submissionIds)

  if (error || !data || data.length === 0) {
    return new Map()
  }

  const links = data as { submission_id: number; project_id: number; sort_order: number }[]
  const projectIds = [...new Set(links.map((link) => link.project_id))]
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, title')
    .in('id', projectIds)
    .eq('status', 'approved')
    .eq('moderation_state', 'approved')

  if (projectsError || !projects) {
    return new Map()
  }

  const projectsById = new Map((projects as { id: number; title: string }[]).map((project) => [project.id, project]))
  const grouped = new Map<number, ObservationLinkedItem[]>()

  for (const link of links.sort((a, b) => a.sort_order - b.sort_order)) {
    const project = projectsById.get(link.project_id)
    if (!project) continue
    const current = grouped.get(link.submission_id) || []
    current.push({
      id: project.id,
      title: project.title,
      relationRole: 'reference',
    })
    grouped.set(link.submission_id, current)
  }

  return grouped
}

async function loadProfilesMap(
  supabase: ServerSupabase,
  userIds: string[],
) {
  if (userIds.length === 0) {
    return new Map()
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id')
    .in('id', userIds)

  if (error || !data) {
    return new Map()
  }

  return new Map(
    (data as {
      id: string
      display_name: string | null
      avatar_url: string | null
      equipped_avatar_frame_id: string | null
      equipped_name_color_id: string | null
    }[]).map((profile) => [profile.id, profile]),
  )
}

async function loadRatingsMap(
  supabase: ServerSupabase,
  submissionIds: number[],
): Promise<Map<number, ChallengeSubmissionRatingSummary>> {
  if (submissionIds.length === 0) {
    return new Map()
  }

  const { data, error } = await supabase
    .from('challenge_submission_ratings')
    .select('*')
    .in('submission_id', submissionIds)

  if (error || !data) {
    return new Map()
  }

  const grouped = new Map<number, RatingRow[]>()
  for (const row of data as RatingRow[]) {
    const current = grouped.get(row.submission_id) || []
    current.push(row)
    grouped.set(row.submission_id, current)
  }

  return new Map(
    Array.from(grouped.entries()).map(([submissionId, rows]) => [submissionId, summarizeRatings(rows)]),
  )
}

function attachSubmissionShape(
  submission: SubmissionRow,
  profilesMap: Map<string, {
    display_name: string | null
    avatar_url: string | null
    equipped_avatar_frame_id: string | null
    equipped_name_color_id: string | null
  }>,
  referenceProjectsMap: Map<number, ObservationLinkedItem[]>,
  ratingsMap: Map<number, ChallengeSubmissionRatingSummary>,
): ChallengeSubmission {
  return mapDbChallengeSubmission({
    ...submission,
    profiles: profilesMap.get(submission.user_id) || null,
    referenceProjects: referenceProjectsMap.get(submission.id) || [],
    ratingSummary: ratingsMap.get(submission.id),
  })
}

export async function getChallengeSubmissionByUser(
  supabase: ServerSupabase,
  challengeId: number,
  userId: string,
): Promise<ChallengeSubmission | null> {
  const { data, error } = await supabase
    .from('challenge_submissions')
    .select('*')
    .eq('challenge_id', challengeId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  const submission = data as SubmissionRow
  const [profilesMap, referenceProjectsMap, ratingsMap] = await Promise.all([
    loadProfilesMap(supabase, [submission.user_id]),
    loadReferenceProjects(supabase, [submission.id]),
    loadRatingsMap(supabase, [submission.id]),
  ])

  return attachSubmissionShape(submission, profilesMap, referenceProjectsMap, ratingsMap)
}

export async function getChallengeSubmissions(
  supabase: ServerSupabase,
  challengeId: number,
): Promise<ChallengeSubmission[]> {
  const { data, error } = await supabase
    .from('challenge_submissions')
    .select('*')
    .eq('challenge_id', challengeId)
    .eq('status', 'approved')
    .eq('is_public', true)
    .eq('moderation_state', 'approved')

  if (error || !data) {
    return []
  }

  const submissions = data as SubmissionRow[]
  const [profilesMap, referenceProjectsMap, ratingsMap] = await Promise.all([
    loadProfilesMap(supabase, [...new Set(submissions.map((submission) => submission.user_id))]),
    loadReferenceProjects(supabase, submissions.map((submission) => submission.id)),
    loadRatingsMap(supabase, submissions.map((submission) => submission.id)),
  ])

  return submissions
    .map((submission) => attachSubmissionShape(submission, profilesMap, referenceProjectsMap, ratingsMap))
    .sort((a, b) => {
      if (b.ratingSummary.avgScore !== a.ratingSummary.avgScore) {
        return b.ratingSummary.avgScore - a.ratingSummary.avgScore
      }
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
    })
}

export async function getChallengeSubmissionById(
  supabase: ServerSupabase,
  submissionId: number,
): Promise<ChallengeSubmission | null> {
  const { data, error } = await supabase
    .from('challenge_submissions')
    .select('*')
    .eq('id', submissionId)
    .eq('status', 'approved')
    .eq('is_public', true)
    .eq('moderation_state', 'approved')
    .maybeSingle()

  if (error || !data) {
    return null
  }

  const submission = data as SubmissionRow
  const [profilesMap, referenceProjectsMap, ratingsMap] = await Promise.all([
    loadProfilesMap(supabase, [submission.user_id]),
    loadReferenceProjects(supabase, [submission.id]),
    loadRatingsMap(supabase, [submission.id]),
  ])

  return attachSubmissionShape(submission, profilesMap, referenceProjectsMap, ratingsMap)
}

export async function getMyChallengeSubmissionStatus(
  supabase: ServerSupabase,
  challengeId: number,
  userId: string,
) {
  const { data, error } = await supabase
    .from('challenge_submissions')
    .select('id, status')
    .eq('challenge_id', challengeId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data as { id: number; status: string }
}
