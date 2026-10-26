/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/admin/growth-reviews/route'
import { requireRole } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import { callRpc } from '@/lib/supabase/rpc'
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({}) }))
vi.mock('@/lib/api/auth', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api/auth')>(), requireRole: vi.fn() }))
vi.mock('@/lib/supabase/rpc', () => ({ callRpc: vi.fn() }))
const body = { type: 'completion', id: 22, stages: ['process', 'discovery', 'final'], hash: 'a'.repeat(32), reason: 'Comparison identifies a new observation and failed experiment conclusion' }
const request = (value: unknown) => new NextRequest('http://localhost/api/admin/growth-reviews', { method: 'POST', body: JSON.stringify(value) })
describe('manual growth review API', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(createClient).mockResolvedValue({} as never); vi.mocked(callRpc).mockResolvedValue({ data: { xp_awarded: 200 }, error: null }) })
  it('sends selected stages and observed version to the authenticated atomic RPC', async () => {
    const result = await POST(request(body))
    expect(result.status).toBe(200)
    expect(requireRole).toHaveBeenCalledWith({}, ['moderator', 'admin'])
    expect(callRpc).toHaveBeenCalledWith({}, 'review_growth_reward', { p_type: 'completion', p_id: 22, p_stages: body.stages, p_hash: body.hash, p_reason: body.reason })
  })
  it.each([{ ...body, reason: ' ' }, { ...body, stages: [] }, { ...body, stages: ['final','final'] }, { ...body, stages: ['skip','process'] }, { ...body, type: 'comment', stages: ['final'] }, { ...body, hash: 'stale' }])('rejects incomplete or inappropriate review %j', async value => {
    expect((await POST(request(value))).status).toBe(400)
    expect(callRpc).not.toHaveBeenCalled()
  })
  it('preserves server authorization denial', async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error('Forbidden'))
    expect((await POST(request(body))).status).toBeGreaterThanOrEqual(400)
    expect(callRpc).not.toHaveBeenCalled()
  })
  it('loads a private paginated review queue', async () => {
    const response = await GET(new NextRequest('http://localhost/api/admin/growth-reviews?type=comment&before=25'))
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(callRpc).toHaveBeenCalledWith({}, 'growth_review_queue', { p_type: 'comment', p_before: 25 })
  })
})
