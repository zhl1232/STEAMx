import { expect, it, vi } from 'vitest'
import { summarizeMissingProfiles } from './lib/missing-profiles.mjs'
import { checkMissingProfiles } from './check-missing-profiles.mjs'
it('counts missing users, deduplicates and exposes only truncated IDs and creation dates', () => {
  const user = { id: '12345678-secret', created_at: '2026-10-12', email: 'private', phone: 'private' }
  expect(summarizeMissingProfiles([user, user, { id: 'present', created_at: 'today' }], [{ id: 'present' }])).toEqual({
    userCount: 2, profileCount: 1, missingCount: 1, missing: [{ id: '12345678', created_at: '2026-10-12' }],
  })
})
it('handles empty and complete snapshots', () => {
  expect(summarizeMissingProfiles([], []).missingCount).toBe(0)
  expect(summarizeMissingProfiles([{ id: 'x', created_at: 'today' }], [{ id: 'x' }]).missingCount).toBe(0)
})
it('rejects malformed snapshots instead of reporting zero', () => {
  expect(() => summarizeMissingProfiles([{}], [])).toThrow()
})
it('paginates both endpoints even when servers cap page sizes', async () => {
  const fetchImpl = vi.fn()
    .mockResolvedValueOnce(Response.json({ users: [{ id: 'a', created_at: 'today' }] }))
    .mockResolvedValueOnce(Response.json({ users: [{ id: 'b', created_at: 'today' }] }))
    .mockResolvedValueOnce(Response.json({ users: [] }))
    .mockResolvedValueOnce(Response.json([{ id: 'a' }]))
    .mockResolvedValueOnce(Response.json([]))
  expect(await checkMissingProfiles({ url: 'https://example.test', key: 'fake', fetchImpl })).toMatchObject({ missingCount: 1 })
  expect(String(fetchImpl.mock.calls[1][0])).toContain('page=2')
  expect(String(fetchImpl.mock.calls[4][0])).toContain('offset=1')
  expect(fetchImpl.mock.calls.every(([, options]) => !options.method || options.method === 'GET')).toBe(true)
})
it('rejects request failures', async () => {
  await expect(checkMissingProfiles({ url: 'https://example.test', key: 'fake', fetchImpl: vi.fn(async () => new Response('', { status: 503 })) })).rejects.toThrow()
})
