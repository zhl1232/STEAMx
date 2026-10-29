import { beforeEach, describe, expect, it, vi } from 'vitest'
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: { rpc } }))
import { exchangeCoupon } from './native'
const input = { offerId: 'offer', expectedVersion: 'version', idempotencyKey: 'intent' }
describe('coupon exchange result certainty', () => {
  beforeEach(() => vi.clearAllMocks())
  it('keeps gateway failures unknown rather than reporting a rejected exchange', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'gateway timeout' } })
    await expect(exchangeCoupon('user', input)).rejects.not.toHaveProperty('statusCode', 409)
  })
  it('reports confirmed database rejection with a stable business code', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'insufficient_coins' } })
    await expect(exchangeCoupon('user', input)).rejects.toMatchObject({ statusCode: 409, code: 'INSUFFICIENT_COINS' })
  })
  it('returns the authoritative completed exchange', async () => {
    rpc.mockResolvedValue({ data: { id: 'exchange' }, error: null })
    await expect(exchangeCoupon('user', input)).resolves.toEqual({ id: 'exchange' })
  })
})
