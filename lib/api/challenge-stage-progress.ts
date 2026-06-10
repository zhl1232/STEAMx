import type { SupabaseClient } from '@supabase/supabase-js'

import { mapDbStageProgress, type StageProgress } from '@/lib/mappers/types'
import type { Database } from '@/lib/supabase/types'

type ServerSupabase = SupabaseClient<Database>
type StageProgressRow = Database['public']['Tables']['challenge_stage_progress']['Row']

export async function getStageProgressByUser(
  supabase: ServerSupabase,
  challengeId: number,
  userId: string,
): Promise<StageProgress[]> {
  const { data, error } = await supabase
    .from('challenge_stage_progress')
    .select('*')
    .eq('challenge_id', challengeId)
    .eq('user_id', userId)
    .order('stage_index', { ascending: true })

  if (error || !data) {
    return []
  }

  return (data as StageProgressRow[]).map(mapDbStageProgress)
}

export async function getStageProgressForStage(
  supabase: ServerSupabase,
  challengeId: number,
  userId: string,
  stageIndex: number,
): Promise<StageProgress | null> {
  const { data, error } = await supabase
    .from('challenge_stage_progress')
    .select('*')
    .eq('challenge_id', challengeId)
    .eq('user_id', userId)
    .eq('stage_index', stageIndex)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return mapDbStageProgress(data as StageProgressRow)
}
