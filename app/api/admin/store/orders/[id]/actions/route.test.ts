import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), profile: vi.fn(), rpc: vi.fn(), processRefund: vi.fn(), restartRefund: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser }, from: () => ({ select: () => ({ eq: () => ({ single: mocks.profile }) }) }) }) }))
vi.mock('@/lib/store/operations', () => ({ storeRpc: mocks.rpc }))
vi.mock('@/lib/store/payment-flow', () => ({ processStoreRefund: mocks.processRefund, restartStoreRefund: mocks.restartRefund }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
import { POST } from './route'

const id = '00000000-0000-4000-8000-000000000001'
const params = { params: Promise.resolve({ id }) }
const request = (body: Record<string, unknown>, origin?: string) => new NextRequest(`https://steam.bj.cn/api/admin/store/orders/${id}/actions`, { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(body) })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
  mocks.profile.mockResolvedValue({ data: { role: 'admin' }, error: null })
  mocks.restartRefund.mockResolvedValue('pending')
  mocks.processRefund.mockResolvedValue('pending')
})

describe('administrator refund recovery actions', () => {
  it('requires a logged-in administrator before restarting a refund', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    expect((await POST(request({ action: 'restart_refund', expectedRefundReference: 'old' }), params)).status).toBe(401)
    mocks.profile.mockResolvedValueOnce({ data: { role: 'user' }, error: null })
    expect((await POST(request({ action: 'restart_refund', expectedRefundReference: 'old' }), params)).status).toBe(403)
    expect(mocks.restartRefund).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('rejects a foreign origin and an absent expected refund identity', async () => {
    expect((await POST(request({ action: 'restart_refund', expectedRefundReference: 'old' }, 'https://evil.example'), params)).status).toBe(403)
    expect((await POST(request({ action: 'restart_refund' }), params)).status).toBe(400)
    expect(mocks.restartRefund).not.toHaveBeenCalled()
  })
  it('passes only the reviewed reference and authenticated administrator to restart', async () => {
    const response = await POST(request({ action: 'restart_refund', expectedRefundReference: 'old', amountCents: 1, adminId: 'attacker', refundId: 'chosen-by-client' }), params)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, state: 'pending', pending: true })
    expect(mocks.restartRefund).toHaveBeenCalledWith(id, 'old', 'admin-1')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it.each(['closed', 'abnormal'])('reports %s as requiring attention without changing approval', async (state) => {
    mocks.processRefund.mockResolvedValue(state)
    const response = await POST(request({ action: 'retry_refund' }), params)
    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({ state, pending: true })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('preserves approval when dispatch times out and reports the pending outcome', async () => {
    mocks.processRefund.mockRejectedValueOnce(new Error('timeout'))
    const response = await POST(request({ action: 'approve_refund' }), params)
    expect(response.status).toBe(202)
    expect(mocks.rpc).toHaveBeenCalledWith('store_native_admin_action', expect.objectContaining({ p_order_id: id, p_action: 'approve_refund', p_actor_id: 'admin-1' }))
    expect(await response.json()).toMatchObject({ ok: true, pending: true })
  })
})
