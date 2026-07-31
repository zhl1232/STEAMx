import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { callRpc } from '@/lib/supabase/rpc'

export async function triggerCourseCompletionReconcile(courseId?: number) {
  if (!supabaseAdmin) {
    logger.error('Course completion reconcile skipped: service client unavailable', { courseId })
    return null
  }

  const { data, error } = await callRpc(supabaseAdmin, 'reconcile_course_completions', {
    p_course_id: courseId ?? null,
  })
  if (error) {
    logger.error(error, { context: 'course completion reconcile failed', courseId })
    return null
  }
  return data
}
