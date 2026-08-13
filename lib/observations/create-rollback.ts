import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'

type DbClient = SupabaseClient<Database>

export const OBSERVATION_ROLLBACK_FAILED_MESSAGE = 'Failed to roll back observations'

export async function rollbackCreatedObservations(options: {
  supabase: DbClient
  userId: string
  observationIds: number[]
}): Promise<void> {
  const { supabase, userId, observationIds } = options
  if (observationIds.length === 0) return

  const { data, error } = await supabase
    .from('observation_events')
    .delete()
    .in('id', observationIds)
    .eq('user_id', userId)
    .select('id')

  if (error) throw error

  const deletedIds = new Set((data ?? []).map((row) => row.id))
  const missing = observationIds.filter((id) => !deletedIds.has(id))
  if (missing.length > 0) {
    throw new Error(OBSERVATION_ROLLBACK_FAILED_MESSAGE)
  }
}
