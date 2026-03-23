import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type CompletionAccessRow = {
  id: number
  user_id: string
  is_public: boolean | null
  status: string | null
}

export async function getAccessibleCompletion(
  supabase: SupabaseClient<Database>,
  completionId: number,
  viewerUserId?: string | null,
): Promise<CompletionAccessRow | null> {
  const { data, error } = await supabase
    .from('completed_projects')
    .select('id, user_id, is_public, status')
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
    completion.is_public === true && (!completion.status || completion.status === 'approved')

  return isOwner || isPublicApproved ? completion : null
}
