import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), admin: { from: vi.fn() } as { from: ReturnType<typeof vi.fn> } | null }))
vi.mock('@/lib/supabase/rpc', () => ({ callRpc: mocks.rpc }))
vi.mock('@/lib/supabase/admin', () => ({ get supabaseAdmin() { return mocks.admin } }))
import { settleTimedChallenge } from './challenge-settlement'

describe('settleTimedChallenge', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.admin = { from: vi.fn() } })
  it('returns the atomic RPC result without reading or overwriting balances in JavaScript', async () => {
    const result = { total_submissions: 1, winners: [{ rank: 1, submission_id: 4, title: 'Bridge', avg_score: 4.25, rating_count: 2 }] }
    mocks.rpc.mockResolvedValue({ data: result, error: null })
    await expect(settleTimedChallenge(42)).resolves.toEqual(result)
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(mocks.admin, 'settle_timed_challenge', { p_challenge_id: 42 })
    expect(mocks.admin!.from).not.toHaveBeenCalled()
  })
  it('surfaces the database failure without a fallback balance write', async () => {
    const error = { message: 'legacy_partial_settlement_requires_review' }
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(settleTimedChallenge(42)).rejects.toBe(error)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.admin!.from).not.toHaveBeenCalled()
  })
  it.each([null, {}, 'invalid'])('rejects invalid RPC results: %j', async data => {
    mocks.rpc.mockResolvedValue({ data, error: null })
    await expect(settleTimedChallenge(42)).rejects.toThrow('Invalid challenge settlement result')
  })
  it('fails before RPC when the service client is unavailable', async () => {
    mocks.admin = null
    await expect(settleTimedChallenge(42)).rejects.toThrow('supabaseAdmin not configured')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
