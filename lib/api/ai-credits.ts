import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase/admin'

import {
  FREE_AI_DAILY_CREDITS,
  FREE_AI_PER_REQUEST_CREDIT_CAP,
  MEMBER_AI_MONTHLY_CREDITS,
  getMembershipSummary,
  type MembershipProfile,
  type MembershipSummary,
} from '@/lib/membership'
import type { AiCreditConsumeResult, AiCreditStatus } from '@/lib/ai/tutor/types'
import { parseTutorBilling, TUTOR_MAX_OUTPUT_TOKENS, TUTOR_MAX_TOTAL_TOKENS, validTutorReservationBudget } from '@/lib/ai/tutor/billing'
import type { TutorUsageSnapshot } from '@/lib/ai/tutor/usage'
import type { Database, Json } from '@/lib/supabase/types'

type CreditRpcResult = Record<string, unknown>

export type TutorCreditReservation = {
  ok: boolean
  source?: 'wallet' | 'free'
  receiptId?: number
  maxOutputTokens?: number
  maxTotalTokens?: number
  reservedCredits?: number
  error?: string
  resetAt?: number
}

export async function reserveTutorCredit(userId: string, requestId: string): Promise<TutorCreditReservation> {
  if (!supabaseAdmin) throw new Error('AI credit service unavailable')
  const attempt = async () => {
    const result = await supabaseAdmin.rpc('reserve_tutor_usage_service', {
      p_user_id: userId, p_request_id: requestId, p_max_output_tokens: TUTOR_MAX_OUTPUT_TOKENS,
      p_max_total_tokens: TUTOR_MAX_TOTAL_TOKENS,
    })
    if (result.error) throw result.error
    return result
  }
  // If the first response was lost, retry the same hold rather than reserving again.
  const { data } = await attempt().catch(() => attempt())
  const value = data as CreditRpcResult | null
  if (value?.ok !== true) return { ok: false, error: String(value?.error ?? 'empty_result'),
    resetAt: typeof value?.resetAt === 'number' ? value.resetAt : undefined }
  if ((value.source !== 'wallet' && value.source !== 'free') ||
      !Number.isSafeInteger(value.receiptId) || Number(value.receiptId) <= 0 ||
      !validTutorReservationBudget(value)) {
    throw new Error('Invalid tutor credit reservation')
  }
  return { ok: true, source: value.source, receiptId: value.receiptId as number,
    maxOutputTokens: value.maxOutputTokens as number, maxTotalTokens: value.maxTotalTokens as number,
    reservedCredits: Number(value.reservedCredits ?? 0) }
}

export async function settleTutorCredit(userId: string, receiptId: number, usage: TutorUsageSnapshot | null, cancel = false) {
  if (!supabaseAdmin) throw new Error('AI credit service unavailable')
  const { data, error } = await supabaseAdmin.rpc('settle_tutor_usage_service', {
    p_user_id: userId, p_receipt_id: receiptId, p_usage: usage as unknown as Json, p_cancel: cancel,
  })
  if (error) throw error
  const value = data as CreditRpcResult | null
  const billing = parseTutorBilling(value)
  if (value?.ok !== true || !billing) throw new Error(String(value?.error ?? 'Invalid tutor credit settlement'))
  return billing
}

function nonNegativeCredit(value: unknown, fallback: number): number {
  const amount = value ?? fallback
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    throw new Error('Invalid AI credit status')
  }
  return amount
}

function parseCreditStatus(data: CreditRpcResult | null, membership: MembershipSummary): AiCreditStatus {
  // A pre-migration response uses these same free* keys for counts. Never show
  // those values as credits or silently grant a made-up daily balance.
  if (data?.creditUnit !== 'credits') throw new Error('AI credit policy unavailable')
  const isMember = data.isMember === true
  const monthlyFallback = membership.isActive ? membership.quota : MEMBER_AI_MONTHLY_CREDITS
  return {
    creditUnit: 'credits',
    isMember,
    walletBalance: nonNegativeCredit(data.walletBalance, 0),
    monthlyGrant: nonNegativeCredit(data.monthlyGrant, isMember ? monthlyFallback : 0),
    freeDaily: nonNegativeCredit(data.freeDaily, FREE_AI_DAILY_CREDITS),
    freeUsedToday: nonNegativeCredit(data.freeUsedToday, 0),
    freeRemainingToday: nonNegativeCredit(data.freeRemainingToday, 0),
    dailyChargeCap: nonNegativeCredit(data.dailyChargeCap, FREE_AI_PER_REQUEST_CREDIT_CAP),
    dailyPeriod: String(data.dailyPeriod ?? ''),
    grantPeriod: String(data?.grantPeriod ?? ''),
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
    receiptId: typeof data.receiptId === 'number' ? data.receiptId : undefined,
  }
}

export async function getAiCreditStatusForProfile(
  supabase: SupabaseClient<Database>,
  profile: MembershipProfile | null | undefined,
) {
  const membership = getMembershipSummary(profile)
  const { data, error } = await supabase.rpc('get_ai_credit_status', {
    p_is_member: membership.isActive,
    p_monthly_grant: membership.isActive ? membership.quota : 0,
    p_free_daily: FREE_AI_DAILY_CREDITS,
  } as never)

  if (error) throw error
  return parseCreditStatus((data ?? null) as CreditRpcResult | null, membership)
}

export async function consumeAiCredit(
  supabase: SupabaseClient<Database>,
  profile: MembershipProfile | null | undefined,
  cost: number,
  userId: string,
) {
  void supabase
  void profile
  if (!supabaseAdmin) throw new Error('supabaseAdmin not configured, cannot consume AI credit')
  const { data, error } = await supabaseAdmin.rpc('consume_ai_credit_service', {
    p_user_id: userId,
    p_cost: cost,
  } as never)

  if (error) throw error
  return parseConsumeResult((data ?? null) as CreditRpcResult | null)
}

export async function refundAiCredit(
  supabase: SupabaseClient<Database>,
  /** Cumulative refund target for this debit receipt; retries with the same target are no-ops. */
  totalRefundCost: number,
  source: 'wallet' | 'free',
  receiptId: number,
  userId: string,
) {
  void supabase
  if (!supabaseAdmin) throw new Error('supabaseAdmin not configured, cannot refund AI credit')
  const { data, error } = await supabaseAdmin.rpc('refund_ai_credit_service', {
    p_user_id: userId,
    p_refund_cost: totalRefundCost,
    p_source: source,
    p_receipt_id: receiptId,
  } as never)

  if (error) throw error
  const result = (data ?? null) as CreditRpcResult | null
  if (result?.ok !== true) {
    throw new Error(typeof result?.error === 'string' ? result.error : 'AI credit refund failed')
  }
  return result
}
