/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: { rpc: (...args: unknown[]) => rpc(...args) } }))

import {
  FREE_OBSERVATION_IDENTIFY_DAILY_LIMIT,
  isObservationIdentifyMember,
  refundObservationIdentifyQuota,
  reserveObservationIdentifyQuota,
} from '@/lib/observations/identify-quota'

describe('observation identify quota', () => {
  beforeEach(() => rpc.mockReset())

  it('reserves through the service-role RPC with the free daily limit', async () => {
    rpc.mockResolvedValue({ data: { granted: 2, used: 5, limit: 5, usageDate: '2026-10-14' }, error: null })
    const result = await reserveObservationIdentifyQuota('u1', 4)
    expect(rpc).toHaveBeenCalledWith('reserve_observation_identify_quota', { p_user_id: 'u1', p_count: 4, p_limit: FREE_OBSERVATION_IDENTIFY_DAILY_LIMIT })
    expect(result).toMatchObject({ granted: 2, used: 5, remaining: 0, usageDate: '2026-10-14', isMember: false })
  })

  it('never grants more than requested even if the RPC misreports', async () => {
    rpc.mockResolvedValue({ data: { granted: 9, used: 3 }, error: null })
    expect((await reserveObservationIdentifyQuota('u1', 1)).granted).toBe(1)
  })

  it('propagates RPC errors (fail closed: no model call)', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('boom') })
    await expect(reserveObservationIdentifyQuota('u1', 1)).rejects.toThrow('boom')
  })

  it('refunds failed photos for the reserved day only', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await refundObservationIdentifyQuota('u1', '2026-10-14', 2)
    expect(rpc).toHaveBeenCalledWith('refund_observation_identify_quota', { p_user_id: 'u1', p_usage_date: '2026-10-14', p_count: 2 })
    rpc.mockClear()
    await refundObservationIdentifyQuota('u1', null, 2)
    await refundObservationIdentifyQuota('u1', '2026-10-14', 0)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('uses the existing membership rules', async () => {
    const supabase = (profile: unknown) => ({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }) }) }),
    }) as never
    expect(await isObservationIdentifyMember(supabase({ membership_tier: 'pro', membership_period: 'lifetime' }), 'u1')).toBe(true)
    expect(await isObservationIdentifyMember(supabase({ membership_tier: 'free', membership_period: 'none' }), 'u1')).toBe(false)
    expect(await isObservationIdentifyMember(supabase({ membership_tier: 'pro', membership_period: 'monthly', membership_expires_at: '2000-01-01T00:00:00Z' }), 'u1')).toBe(false)
  })
})
