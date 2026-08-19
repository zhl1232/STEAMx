import type { Database, Json } from '@/lib/supabase/types'

export const JOURNEY_SOURCE_TYPES = ['project', 'challenge'] as const
export type JourneySourceType = (typeof JOURNEY_SOURCE_TYPES)[number]

export const JOURNEY_STATUSES = ['active', 'completed', 'abandoned'] as const
export type JourneyStatus = (typeof JOURNEY_STATUSES)[number]

export const JOURNEY_RECORD_KINDS = ['progress', 'final'] as const
export type JourneyRecordKind = (typeof JOURNEY_RECORD_KINDS)[number]

export const JOURNEY_ANCHOR_TYPES = ['step', 'stage', 'extra', 'final'] as const
export type JourneyAnchorType = (typeof JOURNEY_ANCHOR_TYPES)[number]

export const JOURNEY_RECORD_VISIBILITIES = ['private', 'public'] as const
export type JourneyRecordVisibility = (typeof JOURNEY_RECORD_VISIBILITIES)[number]

export const JOURNEY_RECORD_STATUSES = ['draft', 'pending', 'approved', 'rejected'] as const
export type JourneyRecordStatus = (typeof JOURNEY_RECORD_STATUSES)[number]

export type JourneyRow = Database['public']['Tables']['project_journeys']['Row']
export type JourneyRecordRow = Database['public']['Tables']['project_journey_records']['Row']

export type Journey = JourneyRow & {
  sourceId: number
}

export type JourneyRecord = JourneyRecordRow

export type JourneyRecordContent = {
  title?: string | null
  notes?: string | null
  images?: string[]
  imageCaptions?: string[] | null
  videoUrl?: string | null
  data?: Json | null
}

export type JourneyRecordWrite = JourneyRecordContent & {
  recordId?: number
  recordKind?: JourneyRecordKind
  anchorType?: JourneyAnchorType
  anchorIndex?: number | null
  visibility?: JourneyRecordVisibility
  /** 服务端审核结果；客户端不能直接传入。 */
  moderationState?: string
  moderationSource?: string | null
  rejectionReason?: string | null
  reviewedBy?: string | null
  reviewedAt?: string | null
}

export function getJourneySourceId(row: Pick<JourneyRow, 'source_type' | 'project_id' | 'challenge_id'>) {
  return row.source_type === 'project' ? row.project_id : row.challenge_id
}

export function mapJourney(row: JourneyRow): Journey {
  const sourceId = getJourneySourceId(row)
  if (!sourceId) {
    throw new Error(`Journey ${row.id} has no source id`)
  }
  return { ...row, sourceId }
}

export function mapJourneyRecord(row: JourneyRecordRow): JourneyRecord {
  return row
}

