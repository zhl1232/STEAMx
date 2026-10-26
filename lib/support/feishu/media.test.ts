import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mock = vi.hoisted(() => ({ fetch: vi.fn(), options: undefined as { global: { fetch: typeof fetch }; auth: Record<string, boolean> } | undefined, bucket: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: (_url: string, _key: string, options: typeof mock.options) => { mock.options = options; return { storage: { from: mock.bucket } } } }))
vi.mock('@/lib/supabase/fetch', () => ({ fetchWithSupabaseTimeout: mock.fetch }))
import { feishuStorage } from './media'
beforeEach(() => {
  vi.clearAllMocks(); mock.options = undefined
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://private.example.test')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'private-key')
  mock.fetch.mockResolvedValue(new Response('{}'))
})
afterEach(() => vi.unstubAllEnvs())
describe('operation-scoped private storage transport', () => {
  it('uses only the private bucket and rejects redirects on the configured origin', async () => {
    feishuStorage(new AbortController().signal)
    expect(mock.bucket).toHaveBeenCalledWith('support-private')
    expect(mock.options?.auth).toMatchObject({ autoRefreshToken: false, persistSession: false })
    await mock.options!.global.fetch('https://private.example.test/storage/v1/object/support-private/path', { method: 'POST' })
    expect(mock.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ redirect: 'error', signal: expect.any(AbortSignal) }))
  })
  it('does not send credentials to a different origin or a non-storage endpoint', async () => {
    feishuStorage(new AbortController().signal)
    for (const url of ['https://other.test/storage/v1/object/path', 'https://private.example.test/auth/v1/token']) {
      await expect(mock.options!.global.fetch(url, { headers: { authorization: 'Bearer private-key' } })).rejects.toThrow(/^storage_unavailable$/)
    }
    expect(mock.fetch).not.toHaveBeenCalled()
  })
  it('forwards operation abort to a pending upload request', async () => {
    const controller = new AbortController()
    feishuStorage(controller.signal)
    mock.fetch.mockImplementation((_input, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('private-error')), { once: true })))
    const request = mock.options!.global.fetch('https://private.example.test/storage/v1/object/path', { method: 'POST' })
    controller.abort()
    await expect(request).rejects.toThrow(/^storage_unavailable$/)
    await expect(mock.options!.global.fetch('https://private.example.test/storage/v1/object/path')).rejects.toThrow(/^storage_unavailable$/)
    expect(mock.fetch).toHaveBeenCalledTimes(1)
  })
  it('rejects missing credentials with a fixed error', () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    expect(() => feishuStorage(new AbortController().signal)).toThrow(/^storage_unavailable$/)
    expect(mock.fetch).not.toHaveBeenCalled()
  })
})
