import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'
import type { createClient } from '@/lib/supabase/server'
type Client = Awaited<ReturnType<typeof createClient>>
const mocks = vi.hoisted(() => ({ db: null as unknown as Client, user: null as unknown as User, member: false }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => mocks.db }))
vi.mock('@/lib/api/auth', () => ({ requireAuth: async () => mocks.user, handleApiError: () => new Response('', { status: 500 }) }))
vi.mock('@/lib/api/rate-limit', () => ({ requireRateLimit: vi.fn() }))
import { GET, PUT } from './route'
beforeEach(() => {
  mocks.member = false
  mocks.user = { id: 'one', user_metadata: {} } as User
  const query = { select: () => query, eq: vi.fn(() => query), maybeSingle: async () => ({ data: { membership_tier: mocks.member ? 'pro' : 'free', membership_period: 'lifetime' } }) }
  mocks.db = { from: () => query, auth: { updateUser: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { mocks.user.user_metadata = data; return { error: null } }) } } as unknown as Client
})
const put = (voice: string) => PUT(new NextRequest('https://test/api/tutor/speech/voices', { method: 'PUT', body: JSON.stringify({ voice }) }))
it('denies nonmember writes at the server even with a valid male voice', async () => {
  expect((await put('anmingyuan_v3.1')).status).toBe(403)
  expect(mocks.db.auth.updateUser).not.toHaveBeenCalled()
})
it('validates the whitelist, persists an active member choice and restores it on GET', async () => {
  mocks.member = true
  expect((await put('arbitrary-cloned-voice')).status).toBe(400)
  expect(mocks.db.auth.updateUser).not.toHaveBeenCalled()
  expect((await put('anmingyuan_v3.1')).status).toBe(200)
  expect(await (await GET()).json()).toMatchObject({ canChoose: true, voice: 'anmingyuan_v3.1' })
  mocks.member = false
  expect(await (await GET()).json()).toMatchObject({ canChoose: false, voice: 'yezhiqing_v3.1' })
})
