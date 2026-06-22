import type { SupabaseClient } from '@supabase/supabase-js'

import {
  FREE_AI_DAILY_QUOTA,
  MEMBER_AI_MONTHLY_CREDITS,
  getMembershipSummary,
  type MembershipProfile,
} from '@/lib/membership'
import type { AiCreditConsumeResult, AiCreditStatus } from '@/lib/ai/tutor/types'
import type { Database } from '@/lib/supabase/types'

type CreditRpcResult = Record<string, unknown>

function parseCreditStatus(data: CreditRpcResult | null): AiCreditStatus {
  const grantPeriod = typeof data?.grantPeriod === 'string' ? data.grantPeriod : ''

  return {
    isMember: Boolean(data?.isMember),
    walletBalance: Number(data?.walletBalance ?? 0),
    monthlyGrant: Number(data?.monthlyGrant ?? MEMBER_AI_MONTHLY_CREDITS),
    freeDaily: Number(data?.freeDaily ?? FREE_AI_DAILY_QUOTA),
    freeUsedToday: Number(data?.freeUsedToday ?? 0),
    freeRemainingToday: Number(data?.freeRemainingToday ?? 0),
    grantPeriod,
    dayResetAt: Number(data?.dayResetAt ?? 0),
    canChat: Boolean(data?.canChat),
  }
}

function parseConsumeResult(data: CreditRpcResult | null): AiCreditConsumeResult {
  if (!data) return { ok: false, error: 'empty_result' }
  return {
    ok: Boolean(data.ok),
    source: data.source === 'wallet' || data.source === 'free' ? data.source : undefined,
    remaining: typeof data.remaining === 'number' ? data.remaining : undefined,
    cost: typeof data.cost === 'number' ? data.cost : undefined,
    error: typeof data.error === 'string' ? data.error : undefined,
    resetAt: typeof data.resetAt === 'number' ? data.resetAt : undefined,
    freeUsedToday: typeof data.freeUsedToday === 'number' ? data.freeUsedToday : undefined,
    freeDaily: typeof data.freeDaily === 'number' ? data.freeDaily : undefined,
  }
}

export async function getAiCreditStatusForProfile(
  supabase: SupabaseClient<Database>,
  profile: MembershipProfile | null | undefined,
) {
  const membership = getMembershipSummary(profile)
  const { data, error } = await supabase.rpc('get_ai_credit_status', {
    p_is_member: membership.isActive,
    p_monthly_grant: MEMBER_AI_MONTHLY_CREDITS,
    p_free_daily: FREE_AI_DAILY_QUOTA,
  } as never)

  if (error) throw error
  return parseCreditStatus((data ?? null) as CreditRpcResult | null)
}

export async function consumeAiCredit(
  supabase: SupabaseClient<Database>,
  profile: MembershipProfile | null | undefined,
  cost: number,
) {
  const membership = getMembershipSummary(profile)
  const { data, error } = await supabase.rpc('consume_ai_credit', {
    p_cost: cost,
    p_is_member: membership.isActive,
    p_monthly_grant: MEMBER_AI_MONTHLY_CREDITS,
    p_free_daily: FREE_AI_DAILY_QUOTA,
  } as never)

  if (error) throw error
  return parseConsumeResult((data ?? null) as CreditRpcResult | null)
}

export async function refundAiCredit(
  supabase: SupabaseClient<Database>,
  cost: number,
  source: 'wallet' | 'free',
) {
  const { data, error } = await supabase.rpc('refund_ai_credit', {
    p_cost: cost,
    p_source: source,
  } as never)

  if (error) throw error
  return (data ?? null) as CreditRpcResult | null
}
