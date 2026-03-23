import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type ProjectAccessRow = {
  id: number
  author_id: string
  status: string | null
}

type ChallengeRatingProjectAccessRow = ProjectAccessRow & {
  challenge_id: number | null
}

export function canAccessProject(
  project: Pick<ProjectAccessRow, 'author_id' | 'status'> | null,
  viewerUserId?: string | null,
) {
  if (!project) return false
  if (!project.status || project.status === 'approved') return true
  return viewerUserId != null && project.author_id === viewerUserId
}

export async function getAccessibleProject(
  supabase: SupabaseClient<Database>,
  projectId: number,
  viewerUserId?: string | null,
): Promise<ProjectAccessRow | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, author_id, status')
    .eq('id', projectId)
    .maybeSingle()

  if (error) {
    throw error
  }

  const project = data as ProjectAccessRow | null
  return canAccessProject(project, viewerUserId) ? project : null
}

export async function getChallengeRatingProject(
  supabase: SupabaseClient<Database>,
  projectId: number,
): Promise<ChallengeRatingProjectAccessRow | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, author_id, status, challenge_id')
    .eq('id', projectId)
    .maybeSingle()

  if (error) {
    throw error
  }

  const project = data as ChallengeRatingProjectAccessRow | null

  if (!project) {
    return null
  }

  if (project.status !== 'approved' || project.challenge_id == null) {
    return null
  }

  return project
}
