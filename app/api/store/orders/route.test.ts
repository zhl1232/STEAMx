import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), from: vi.fn(), select: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }) }))
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: null }))

describe('purchase intention recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'current-buyer' } }, error: null })
    const builder = { select: mocks.select, eq: mocks.eq, maybeSingle: mocks.maybeSingle }
    mocks.from.mockReturnValue(builder)
    mocks.select.mockReturnValue(builder)
    mocks.eq.mockReturnValue(builder)
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
  })

  it('only looks up the signed-in buyer intention and never creates a new order', async () => {
    const response = await GET(new NextRequest('http://localhost/api/store/orders?intent=web-stable&userId=another-buyer'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ order: null })
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'current-buyer')
    expect(mocks.eq).toHaveBeenCalledWith('external_order_id', 'web-stable')
    expect(mocks.from).toHaveBeenCalledOnce()
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })

  it('requires login even when the caller knows an intention key', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const response = await GET(new NextRequest('http://localhost/api/store/orders?intent=web-stable'))
    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects empty keys rather than falling through to a broad order listing', async () => {
    const response = await GET(new NextRequest('http://localhost/api/store/orders?intent='))
    expect(response.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
