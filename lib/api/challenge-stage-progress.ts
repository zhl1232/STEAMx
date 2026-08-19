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

  const rows = data as StageProgressRow[]
  const recordIds = rows
    .map((row) => row.journey_record_id)
    .filter((id): id is number => Number.isInteger(id))
  const { data: records, error: recordsError } = recordIds.length > 0
    ? await supabase
        .from('project_journey_records')
        .select('id, visibility, status, rejection_reason')
        .in('id', recordIds)
    : { data: [], error: null }
  if (recordsError) return rows.map(mapDbStageProgress)

  const recordById = new Map(
    ((records || []) as {
      id: number
      visibility: string
      status: string
      rejection_reason: string | null
    }[]).map((record) => [record.id, record]),
  )

  return rows.map((row) => {
    const record = row.journey_record_id ? recordById.get(row.journey_record_id) : undefined
    return mapDbStageProgress({
      ...row,
      journey_record_visibility: record?.visibility === 'public' ? 'public' : record ? 'private' : null,
      journey_record_status:
        record?.status === 'pending' || record?.status === 'approved' || record?.status === 'rejected'
          ? record.status
          : record
            ? 'draft'
            : null,
      journey_record_rejection_reason: record?.rejection_reason ?? null,
    })
  })
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

  const row = data as StageProgressRow
  const record = row.journey_record_id
    ? await supabase
        .from('project_journey_records')
        .select('visibility, status, rejection_reason')
        .eq('id', row.journey_record_id)
        .maybeSingle()
    : { data: null, error: null }
  if (record.error) return mapDbStageProgress(row)

  return mapDbStageProgress({
    ...row,
    journey_record_visibility: record.data?.visibility === 'public' ? 'public' : record.data ? 'private' : null,
    journey_record_status:
      record.data?.status === 'pending' || record.data?.status === 'approved' || record.data?.status === 'rejected'
        ? record.data.status
        : record.data
          ? 'draft'
          : null,
    journey_record_rejection_reason: record.data?.rejection_reason ?? null,
  })
}
