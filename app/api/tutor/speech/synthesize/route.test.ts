import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ session: vi.fn(), member: false, stored: 'anmingyuan_v3.1' }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { membership_tier: mocks.member ? 'pro' : 'free', membership_period: 'lifetime' } }) }
  return { from: () => query }
} }))
vi.mock('@/lib/api/auth', () => ({ requireAuth: async () => ({ id: 'one', user_metadata: { tutor_voice: mocks.stored } }), handleApiError: () => new Response('', { status: 500 }) }))
vi.mock('@/lib/api/rate-limit', () => ({ requireRateLimit: vi.fn() }))
vi.mock('@/lib/ai/tutor/speech', async (original) => ({
  ...await original<typeof import('@/lib/ai/tutor/speech')>(), createTutorRealtimeTtsSession: mocks.session,
}))
import { POST } from './route'
beforeEach(() => {
  vi.clearAllMocks(); mocks.member = false; mocks.stored = 'anmingyuan_v3.1'
  mocks.session.mockReturnValue({ ready: Promise.resolve(), append: vi.fn(), finish: vi.fn().mockResolvedValue(undefined), abort: vi.fn() })
})
const post = (voice?: string) => POST(new NextRequest('https://test/api/tutor/speech/synthesize', { method: 'POST', body: JSON.stringify({ text: '一起试试吧。', voice }) }))
it('rejects nonmember previews before supplier access and ignores nonmember stored premium choices', async () => {
  expect((await post('anmingyuan_v3.1')).status).toBe(403)
  expect(mocks.session).not.toHaveBeenCalled()
  const response = await post(); await response.text()
  expect(mocks.session).toHaveBeenCalledWith(expect.objectContaining({ voice: 'yezhiqing_v3.1', signal: expect.any(AbortSignal) }))
})
it('allows member male previews only from the whitelist', async () => {
  mocks.member = true
  expect((await post('Ethan')).status).toBe(400)
  expect(mocks.session).not.toHaveBeenCalled()
  await (await post('longsanshu_v3.1')).text()
  expect(mocks.session).toHaveBeenCalledWith(expect.objectContaining({ voice: 'longsanshu_v3.1' }))
})
