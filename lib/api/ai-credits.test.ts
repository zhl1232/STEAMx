import { beforeEach, describe, expect, it, vi } from 'vitest'

import { consumeAiCredit, getAiCreditStatusForProfile, refundAiCredit, reserveTutorCredit, settleTutorCredit } from './ai-credits'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createTutorUsageCollector } from '@/lib/ai/tutor/usage'

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { rpc: vi.fn() },
}))

describe('AI credit service RPC contract', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes the trusted user ID and returns the debit receipt', async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { ok: true, source: 'free', cost: 2, receiptId: 41 },
      error: null,
    } as never)

    const result = await consumeAiCredit({} as never, null, 2, 'user-1')

    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('consume_ai_credit_service', {
      p_user_id: 'user-1',
      p_cost: 2,
    })
    expect(result).toMatchObject({ ok: true, source: 'free', receiptId: 41 })
  })

  it('binds refunds to the original receipt and trusted user ID', async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { ok: true, refunded: 1, receiptId: 41 },
      error: null,
    } as never)

    await refundAiCredit({} as never, 2, 'free', 41, 'user-1')

    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('refund_ai_credit_service', {
      p_user_id: 'user-1',
      p_refund_cost: 2,
      p_source: 'free',
      p_receipt_id: 41,
    })
  })

  it('rejects a failed refund result from the service RPC', async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { ok: false, error: 'invalid_receipt' },
      error: null,
    } as never)

    await expect(refundAiCredit({} as never, 2, 'free', 41, 'user-1'))
      .rejects.toThrow('invalid_receipt')
  })

  it('reserves a total request budget independently of the output cap', async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: {
      ok: true, source: 'wallet', maxOutputTokens: 8192, maxTotalTokens: 125, reservedCredits: 1.25, receiptId: 11,
    }, error: null } as never)
    expect(await reserveTutorCredit('user-1', 'request-1')).toMatchObject({ maxOutputTokens: 8192, maxTotalTokens: 125, reservedCredits: 1.25 })
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('reserve_tutor_usage_service', {
      p_user_id: 'user-1', p_request_id: 'request-1', p_max_output_tokens: 8192,
      p_max_total_tokens: 131072,
    })
  })

  it('accepts subsidized work only for an explicit capped daily-credit policy', async () => {
    const daily = { ok: true, source: 'free', creditUnit: 'credits', creditPolicy: 'daily_credits_v1', dailyChargeCap: 100, receiptId: 11,
      maxOutputTokens: 8192, maxTotalTokens: 30_000, reservedCredits: 100 }
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: daily, error: null } as never)
    expect(await reserveTutorCredit('user-1', 'request-1')).toMatchObject({ source: 'free', maxTotalTokens: 30_000, reservedCredits: 100 })
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: { ...daily, reservedCredits: 12.25 }, error: null } as never)
    expect(await reserveTutorCredit('user-1', 'request-2')).toMatchObject({ maxTotalTokens: 30_000, reservedCredits: 12.25 })
    for (const patch of [{ maxTotalTokens: 131072 }, { maxTotalTokens: Infinity }, { reservedCredits: NaN },
      { reservedCredits: 0 }, { reservedCredits: 300 }, { creditPolicy: undefined }, { dailyChargeCap: 300 },
      { creditUnit: undefined }, { source: 'wallet' }]) {
      vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: { ...daily, ...patch }, error: null } as never)
      await expect(reserveTutorCredit('user-1', 'request-3')).rejects.toThrow('Invalid tutor credit reservation')
    }
  })

  it('uses the authoritative status and keeps fractional daily credits in their own unit', async () => {
    const authority = { creditUnit: 'credits', isMember: true, walletBalance: 19000.01, monthlyGrant: 20_000,
      freeDaily: 300, freeUsedToday: 12.34, freeRemainingToday: 287.66, dailyChargeCap: 100, dailyPeriod: '2026-10-12',
      grantPeriod: '2026-10', dayResetAt: 1_800_000_000, canChat: true }
    const rpc = vi.fn().mockResolvedValue({ data: authority, error: null })
    expect(await getAiCreditStatusForProfile({ rpc } as never, null)).toEqual(authority)
  })

  it('falls back to the founder grant without treating every member as pro', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { creditUnit: 'credits', isMember: true,
      freeDaily: 300, freeRemainingToday: 300, dailyPeriod: '2026-10-12' }, error: null })
    const status = await getAiCreditStatusForProfile({ rpc } as never, { membership_tier: 'founder', membership_period: 'founder' })
    expect(status.monthlyGrant).toBe(20_000)
    expect(rpc).toHaveBeenCalledWith('get_ai_credit_status', { p_is_member: true, p_monthly_grant: 20_000, p_free_daily: 150 })
  })

  it('does not relabel an old count response or non-finite balances as daily credits', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { isMember: false, freeDaily: 5, freeRemainingToday: 4 }, error: null })
    await expect(getAiCreditStatusForProfile({ rpc } as never, null)).rejects.toThrow('AI credit policy unavailable')
    rpc.mockResolvedValue({ data: { creditUnit: 'credits', freeRemainingToday: Infinity }, error: null })
    await expect(getAiCreditStatusForProfile({ rpc } as never, null)).rejects.toThrow('Invalid AI credit status')
  })

  it('settles fractional credits and preserves unknown usage without estimates', async () => {
    const billing = { source: 'wallet', chargedCredits: 0.1, receiptId: 11 }
    const usage = createTutorUsageCollector({ maxTotalTokens: 131072 }).snapshot()
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: { ok: true, ...billing }, error: null } as never)
    expect(await settleTutorCredit('user-1', 11, usage)).toEqual(billing)
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('settle_tutor_usage_service', {
      p_user_id: 'user-1', p_receipt_id: 11, p_usage: usage, p_cancel: false,
    })
    await settleTutorCredit('user-1', 11, null, true)
    expect(supabaseAdmin.rpc).toHaveBeenLastCalledWith('settle_tutor_usage_service', {
      p_user_id: 'user-1', p_receipt_id: 11, p_usage: null, p_cancel: true,
    })
  })

  it('returns a positive daily-credit charge without turning it into a free round', async () => {
    const billing = { source: 'free', chargedCredits: 48.23, receiptId: 11 }
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: { ok: true, ...billing }, error: null } as never)
    expect(await settleTutorCredit('user-1', 11, createTutorUsageCollector({ maxTotalTokens: 30_000 }).snapshot())).toEqual(billing)
  })

  it('retries an uncertain reservation response using the same request ID', async () => {
    vi.mocked(supabaseAdmin.rpc).mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce({
      data: { ok: true, source: 'wallet', maxOutputTokens: 8192, maxTotalTokens: 131072, reservedCredits: 1310.72, receiptId: 11 }, error: null,
    } as never)
    await reserveTutorCredit('user-1', 'same-request')
    expect(supabaseAdmin.rpc).toHaveBeenCalledTimes(2)
    expect(vi.mocked(supabaseAdmin.rpc).mock.calls[0]).toEqual(vi.mocked(supabaseAdmin.rpc).mock.calls[1])
  })

  it('rejects unsuccessful settlements instead of claiming a charge succeeded', async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: { ok: false, error: 'invalid_receipt' }, error: null } as never)
    await expect(settleTutorCredit('user-1', 11, createTutorUsageCollector({ maxTotalTokens: 100 }).snapshot())).rejects.toThrow('invalid_receipt')
  })
})
