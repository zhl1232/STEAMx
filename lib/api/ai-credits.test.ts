import { beforeEach, describe, expect, it, vi } from 'vitest'

import { consumeAiCredit, refundAiCredit, reserveTutorCredit, settleTutorCredit } from './ai-credits'
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
