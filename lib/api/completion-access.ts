import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { getContentClassificationSettings } from '@/lib/content-classification'

type CompletionAccessRow = {
  id: number
  user_id: string
  project_id: number | null
  course_lesson_id: number | null
  is_public: boolean | null
  status: string | null
  moderation_state: string | null
}

export async function getAccessibleCompletion(
  supabase: SupabaseClient<Database>,
  completionId: number,
  viewerUserId?: string | null,
): Promise<CompletionAccessRow | null> {
  const { data, error } = await supabase
    .from('completed_projects')
    .select('id, user_id, project_id, course_lesson_id, is_public, status, moderation_state')
    .eq('id', completionId)
    .maybeSingle()

  if (error) {
    throw error
  }

  const completion = data as CompletionAccessRow | null
  if (!completion) {
    return null
  }

  const isOwner = viewerUserId != null && completion.user_id === viewerUserId
  const isPublicApproved =
    completion.is_public === true &&
    (!completion.status || completion.status === 'approved') &&
    completion.moderation_state === 'approved'

  if (isOwner) return completion
  if (!isPublicApproved) return null

  const settings = await getContentClassificationSettings()
  if (!settings.enforcementEnabled) return completion

  if (completion.project_id != null) {
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('status, moderation_state, classification_status')
      .eq('id', completion.project_id)
      .maybeSingle()

    if (projectError) throw projectError
    if (
      !project
      || project.status !== 'approved'
      || project.moderation_state !== 'approved'
      || project.classification_status !== 'reviewed'
    ) return null
  } else if (completion.course_lesson_id != null) {
    const { data: lesson, error: lessonError } = await supabase
      .from('course_lessons')
      .select('course_id')
      .eq('id', completion.course_lesson_id)
      .maybeSingle()

    if (lessonError) throw lessonError
    if (!lesson) return null

    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('status, classification_status')
      .eq('id', lesson.course_id)
      .maybeSingle()

    if (courseError) throw courseError
    if (!course || course.status !== 'approved' || course.classification_status !== 'reviewed') {
      return null
    }
  }

  return completion
}
