import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: null }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
import { ensureProfile } from './ensure-profile'
import { getDefaultAvatarPath } from '@/lib/profile/avatar-options'

const maybeSingle = vi.fn()
const limit = vi.fn()
const insertResult = vi.fn()
const upsert = vi.fn(() => ({ select: insertResult }))
const query = { select: vi.fn(() => query), eq: vi.fn(() => query), neq: vi.fn(() => query), maybeSingle, limit, upsert }
const client = { from: vi.fn(() => query) } as unknown as NonNullable<Parameters<typeof ensureProfile>[0]['client']>
beforeEach(() => {
  vi.clearAllMocks()
  maybeSingle.mockReset().mockResolvedValue({ data: null, error: null })
  limit.mockReset().mockResolvedValue({ data: [], error: null })
  insertResult.mockReset().mockResolvedValue({ data: [{ id: 'u1' }], error: null })
})
it('does not change an existing profile', async () => {
  maybeSingle.mockResolvedValueOnce({ data: { id: 'u1' }, error: null })
  expect(await ensureProfile({ userId: 'u1', client })).toEqual({ ok: true, created: false })
  expect(upsert).not.toHaveBeenCalled()
})
it('creates with trimmed metadata and a default avatar', async () => {
  expect(await ensureProfile({ userId: 'u1', client, userMetadata: { username: ' alice ', full_name: ' Alice ' } })).toEqual({ ok: true, created: true })
  expect(upsert).toHaveBeenCalledWith({ id: 'u1', username: 'alice', display_name: 'Alice', avatar_url: getDefaultAvatarPath('u1') }, { onConflict: 'id', ignoreDuplicates: true })
})
it.each(['', '  ', 'ab', '😀a', null])('replaces invalid username %j and phone display name', async username => {
  await ensureProfile({ userId: 'u1', client, userMetadata: { username, full_name: '13800138000' }, phone: '+8613800138000' })
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ username: expect.stringMatching(/^user_[a-f0-9]{8}$/), display_name: expect.stringMatching(/^新用户[A-F0-9]{4}$/) }), expect.anything())
})
it('replaces an occupied username using a bounded array query', async () => {
  limit.mockResolvedValueOnce({ data: [{ id: 'other' }], error: null })
  expect(await ensureProfile({ userId: 'u1', client, userMetadata: { username: 'taken' } })).toEqual({ ok: true, created: true })
  expect(limit).toHaveBeenCalledWith(1)
  expect(maybeSingle).toHaveBeenCalledTimes(1)
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ username: expect.stringMatching(/^user_[a-f0-9]{8}$/) }), expect.anything())
})
it('retries a unique conflict with a fresh username', async () => {
  insertResult.mockResolvedValueOnce({ error: { code: '23505' } })
  expect(await ensureProfile({ userId: 'u1', client })).toEqual({ ok: true, created: true })
  expect(upsert).toHaveBeenCalledTimes(2)
  expect(upsert.mock.calls[0]).not.toEqual(upsert.mock.calls[1])
})
it('reports a concurrent id insert as not created', async () => {
  insertResult.mockResolvedValueOnce({ data: [], error: null })
  expect(await ensureProfile({ userId: 'u1', client })).toEqual({ ok: true, created: false })
})
it('bounds retries and catches failures', async () => {
  insertResult.mockResolvedValue({ error: { code: '23505' } })
  expect(await ensureProfile({ userId: 'u1', client })).toMatchObject({ ok: false, created: false })
  expect(upsert).toHaveBeenCalledTimes(5)
})
it.each(['read', 'occupied', 'insert', 'throw', 'null'])('does not throw on %s failure', async failure => {
  if (failure === 'read') maybeSingle.mockResolvedValueOnce({ error: { code: '500' } })
  if (failure === 'occupied') limit.mockResolvedValueOnce({ error: { code: '500' } })
  if (failure === 'insert') insertResult.mockResolvedValueOnce({ error: { code: '23514' } })
  if (failure === 'throw') maybeSingle.mockRejectedValueOnce(new Error('offline'))
  await expect(ensureProfile({ userId: 'u1', client: failure === 'null' ? null : client, userMetadata: { username: 'valid' } })).resolves.toMatchObject({ ok: false, created: false })
})
