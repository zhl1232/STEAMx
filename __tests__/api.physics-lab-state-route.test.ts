// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, PUT } from '@/app/api/physics-lab/state/route'
import { emptyPhysicsBackup, MAX_PHYSICS_STATE_BYTES } from '@/lib/physics-lab/state'
import { PermissionError, RateLimitError } from '@/lib/api/auth'

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), access: vi.fn(), rate: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/access/interaction-access', () => ({ requireInteractionAccess: mocks.access }))
vi.mock('@/lib/api/rate-limit', () => ({ requireRateLimit: mocks.rate }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))

type Row = { user_id: string; revision: number; data: unknown; updated_at: string }
let userId: string | null
let rows: Map<string, Row>
let dbError: { code: string } | null
let writes: number

// Model database filtering and unique constraints at the boundary, so account
// isolation and both CAS branches can be exercised without any remote access.
function client() {
  return {
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }) },
    from: (table: string) => {
      expect(table).toBe('physics_lab_states')
      let operation = 'read'
      let payload: Record<string, unknown> = {}
      const filters: Record<string, unknown> = {}
      const finish = async () => {
        if (dbError) return { data: null, error: dbError }
        const owner = String(operation === 'insert' ? payload.user_id : filters.user_id)
        const row = rows.get(owner)
        if (operation === 'insert' && row) return { data: null, error: { code: '23505' } }
        if (operation === 'read') return { data: row ?? null, error: null }
        if (operation === 'update' && (!row || row.revision !== filters.revision)) return { data: null, error: null }
        writes++
        const next = { ...row, ...payload, user_id: owner } as Row
        rows.set(owner, next)
        return { data: next, error: null }
      }
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { filters[key] = value; return query },
        insert: (value: Record<string, unknown>) => { operation = 'insert'; payload = value; return query },
        update: (value: Record<string, unknown>) => { operation = 'update'; payload = value; return query },
        single: finish, maybeSingle: finish,
      }
      return query
    },
  }
}
const put = (revision = 0, ownerId = userId, data: unknown = emptyPhysicsBackup()) => PUT(new Request('http://localhost/api/physics-lab/state', {
  method: 'PUT', body: JSON.stringify({ ownerId, revision, data }),
}))

beforeEach(() => {
  vi.resetAllMocks()
  userId = 'owner-a'; rows = new Map(); dbError = null; writes = 0
  mocks.createClient.mockImplementation(async () => client())
  mocks.access.mockResolvedValue({})
  mocks.rate.mockResolvedValue(undefined)
})

describe('physics lab private state API', () => {
  it('requires authentication on reads and writes and never caches errors', async () => {
    userId = null
    for (const response of [await GET(), await put()]) {
      expect(response.status).toBe(401)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
    }
    expect(writes).toBe(0)
  })

  it('returns an explicit empty account state with private headers', async () => {
    const response = await GET()
    expect(await response.json()).toEqual({ ownerId: 'owner-a', revision: 0, data: null, updatedAt: null })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('vary')).toBe('Cookie')
  })

  it('rejects a stale account owner and restricted interaction access', async () => {
    expect((await put(0, 'owner-b')).status).toBe(403)
    mocks.access.mockRejectedValue(new PermissionError('Restricted'))
    expect((await put()).status).toBe(403)
    expect(writes).toBe(0)
  })

  it('requires save_progress and applies the existing per-user rate limit', async () => {
    await put()
    expect(mocks.access).toHaveBeenCalledWith(expect.anything(), { id: 'owner-a' }, 'save_progress')
    expect(mocks.rate).toHaveBeenCalledWith(expect.anything(), { key: 'api-physics-lab-state', limit: 20, windowMs: 60_000 })
    mocks.rate.mockRejectedValue(new RateLimitError('Too many requests', { limit: 20, remaining: 0, resetAt: 1, retryAfterSeconds: 60 }))
    const response = await put(1)
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('60')
    expect(writes).toBe(1)
  })

  it('inserts revision one, updates only the matching revision, and rejects stale writes', async () => {
    expect(await (await put()).json()).toMatchObject({ ownerId: 'owner-a', revision: 1, data: { version: 1 } })
    expect((await put()).status).toBe(409)
    expect(await (await put(1)).json()).toMatchObject({ revision: 2 })
    expect((await put(1)).status).toBe(409)
    expect(writes).toBe(2)
    expect(await (await GET()).json()).toMatchObject({ revision: 2 })
  })

  it('scopes reads and writes to the authenticated account', async () => {
    await put()
    userId = 'owner-b'
    expect(await (await GET()).json()).toMatchObject({ ownerId: 'owner-b', data: null })
    expect((await put(1)).status).toBe(409)
    expect((await put()).status).toBe(200)
    expect(rows.get('owner-a')?.revision).toBe(1)
    expect(rows.get('owner-b')?.revision).toBe(1)
  })

  it('rejects invalid JSON, revisions, and experiment models without writing', async () => {
    expect((await PUT(new Request('http://localhost', { method: 'PUT', body: '{' }))).status).toBe(400)
    for (const revision of [-1, 0.5, 2147483647]) expect((await put(revision)).status).toBe(400)
    expect((await put(0, userId, { ...emptyPhysicsBackup(), experiments: [{ id: 'x', name: 'bad', scene: {} }] })).status).toBe(400)
    expect(writes).toBe(0)
  })

  it('rejects oversized Content-Length before reading the body', async () => {
    const request = new Request('http://localhost', { method: 'PUT', body: '{}', headers: { 'content-length': String(MAX_PHYSICS_STATE_BYTES + 1025) } })
    expect((await PUT(request)).status).toBe(413)
    expect(writes).toBe(0)
  })

  it('bounds streamed bytes without Content-Length and cancels overflow', async () => {
    const cancel = vi.fn()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(MAX_PHYSICS_STATE_BYTES)); controller.enqueue(new Uint8Array(1025)) }, cancel,
    })
    const request = new Request('http://localhost', { method: 'PUT', body: stream, duplex: 'half' } as RequestInit)
    expect((await PUT(request)).status).toBe(413)
    expect(cancel).toHaveBeenCalledOnce()
    expect(writes).toBe(0)
  })

  it('enforces the backup UTF-8 byte limit independently of the request envelope', async () => {
    const backup = { ...emptyPhysicsBackup(), padding: '界'.repeat(Math.ceil(MAX_PHYSICS_STATE_BYTES / 3)) }
    expect((await put(0, userId, backup)).status).toBe(413)
  })

  it('fails honestly when the table is unavailable', async () => {
    dbError = { code: '42P01' }
    expect((await GET()).status).toBe(500)
    expect((await put()).status).toBe(500)
    expect(writes).toBe(0)
  })
})
