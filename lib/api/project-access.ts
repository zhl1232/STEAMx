import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { getContentClassificationSettings } from '@/lib/content-classification'

type ProjectAccessRow = {
  id: number
  author_id: string
  status: string | null
  moderation_state: string | null
  classification_status?: string | null
  title?: string | null
}

type ChallengeRatingProjectAccessRow = ProjectAccessRow & {
  challenge_id: number | null
}

type ChallengeRatingSubmissionAccessRow = {
  id: number
  user_id: string
  challenge_id: number
  status: string | null
  is_public: boolean
  moderation_state: string | null
}

export function canAccessProject(
  project: Pick<ProjectAccessRow, 'author_id' | 'status' | 'moderation_state' | 'classification_status'> | null,
  viewerUserId?: string | null,
  requireReviewed = false,
) {
  if (!project) return false
  if (
    (!project.status || project.status === 'approved')
    && project.moderation_state === 'approved'
    && (!requireReviewed || project.classification_status === 'reviewed')
  ) return true
  return viewerUserId != null && project.author_id === viewerUserId
}

export async function getAccessibleProject(
  supabase: SupabaseClient<Database>,
  projectId: number,
  viewerUserId?: string | null,
  options?: { requireReviewed?: boolean },
): Promise<ProjectAccessRow | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, author_id, status, moderation_state, classification_status, title')
    .eq('id', projectId)
    .maybeSingle()

  if (error) {
    throw error
  }

  const project = data as ProjectAccessRow | null
  const settings = options?.requireReviewed === undefined
    ? await getContentClassificationSettings()
    : null
  const requireReviewed = options?.requireReviewed ?? settings?.enforcementEnabled ?? false
  return canAccessProject(project, viewerUserId, requireReviewed) ? project : null
}

export async function getChallengeRatingProject(
  supabase: SupabaseClient<Database>,
  projectId: number,
): Promise<ChallengeRatingProjectAccessRow | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, author_id, status, moderation_state, classification_status, challenge_id')
    .eq('id', projectId)
    .maybeSingle()

  if (error) {
    throw error
  }

  const project = data as ChallengeRatingProjectAccessRow | null

  if (!project) {
    return null
  }

  if (project.status !== 'approved' || project.moderation_state !== 'approved' || project.challenge_id == null) {
    return null
  }

  const settings = await getContentClassificationSettings()
  if (settings.enforcementEnabled) {
    if (project.classification_status !== 'reviewed') return null

    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('status, classification_status')
      .eq('id', project.challenge_id)
      .maybeSingle()

    if (challengeError) throw challengeError
    if (
      !challenge
      || !['active', 'ended'].includes(challenge.status)
      || challenge.classification_status !== 'reviewed'
    ) return null
  }

  return project
}

export async function getChallengeRatingSubmission(
  supabase: SupabaseClient<Database>,
  submissionId: number,
): Promise<ChallengeRatingSubmissionAccessRow | null> {
  const { data, error } = await supabase
    .from('challenge_submissions')
    .select('id, user_id, challenge_id, status, is_public, moderation_state')
    .eq('id', submissionId)
    .maybeSingle()

  if (error) {
    throw error
  }

  const submission = data as ChallengeRatingSubmissionAccessRow | null

  if (!submission) {
    return null
  }

  if (submission.status !== 'approved' || submission.moderation_state !== 'approved' || !submission.is_public) {
    return null
  }

  const settings = await getContentClassificationSettings()
  if (settings.enforcementEnabled) {
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('status, classification_status')
      .eq('id', submission.challenge_id)
      .maybeSingle()

    if (challengeError) throw challengeError
    if (
      !challenge
      || !['active', 'ended'].includes(challenge.status)
      || challenge.classification_status !== 'reviewed'
    ) return null
  }

  return submission
}
