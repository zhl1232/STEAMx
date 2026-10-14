import type { SupabaseClient } from '@supabase/supabase-js'

import { getMembershipSummary, type MembershipProfile } from '@/lib/membership'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/types'

/** Free users: photos identified per Beijing day. Members are unlimited. */
export const FREE_OBSERVATION_IDENTIFY_DAILY_LIMIT = 5

export const OBSERVATION_IDENTIFY_QUOTA_MESSAGE = '今天的识别次数用完了，可以手动选物种或按待鉴定发布'

export type ObservationIdentifyQuota = {
  isMember: boolean
  limit: number | null
  used: number | null
  remaining: number | null
  usageDate: string | null
}

export type ObservationIdentifyReservation = ObservationIdentifyQuota & {
  granted: number
}

export async function isObservationIdentifyMember(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('membership_tier, membership_period, membership_started_at, membership_expires_at')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return getMembershipSummary((data ?? null) as MembershipProfile | null).isActive
}

/** Atomically reserves up to `count` photos for today (service role RPC). */
export async function reserveObservationIdentifyQuota(
  userId: string,
  count: number,
  limit = FREE_OBSERVATION_IDENTIFY_DAILY_LIMIT,
): Promise<ObservationIdentifyReservation> {
  if (!supabaseAdmin) throw new Error('supabaseAdmin not configured, cannot reserve identify quota')
  const { data, error } = await supabaseAdmin.rpc('reserve_observation_identify_quota' as never, {
    p_user_id: userId,
    p_count: count,
    p_limit: limit,
  } as never)
  if (error) throw error
  const row = (data ?? {}) as Record<string, unknown>
  const granted = typeof row.granted === 'number' ? Math.max(0, Math.min(count, row.granted)) : 0
  const used = typeof row.used === 'number' ? row.used : limit
  return {
    isMember: false,
    granted,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    usageDate: typeof row.usageDate === 'string' ? row.usageDate : null,
  }
}

export async function refundObservationIdentifyQuota(userId: string, usageDate: string | null, count: number) {
  if (!supabaseAdmin || !usageDate || count <= 0) return
  const { error } = await supabaseAdmin.rpc('refund_observation_identify_quota' as never, {
    p_user_id: userId,
    p_usage_date: usageDate,
    p_count: count,
  } as never)
  if (error) throw error
}
