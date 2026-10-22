import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { createHash, webcrypto } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

function fixture({ noCache = false, corrupt = false } = {}) {
  const bytes = new Uint8Array([1, 2, 3, 4])
  const url = 'https://example.test/courses/vosk/v1/model.tar.gz'
  const entries = new Map<string, Response>()
  if (corrupt) entries.set(url, new Response(new Uint8Array([9])))
  const cache = { match: vi.fn(async (key: string) => entries.get(key)?.clone()), delete: vi.fn(async (key: string) => entries.delete(key)),
    put: vi.fn(async (key: string, response: Response) => { entries.set(key, response.clone()) }) }
  const fetch = vi.fn(async () => new Response(bytes))
  let lock = Promise.resolve<unknown>(undefined)
  const context = { self: { location: { href: 'https://example.test/courses/vosk/v1/prepare-worker.js' }, navigator: { locks: {
    request: (_key: string, task: () => unknown) => { const result = lock.then(task); lock = result.catch(()=>{}); return result },
  } } }, URL, Response, Array, Uint8Array, crypto: webcrypto,
    BUILDING_VOICE_ASSETS: { 'model.tar.gz': { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') } },
    caches: { open: async () => { if (noCache) throw new Error('cache denied'); return cache } }, fetch }
  const read = runInNewContext(readFileSync('public/courses/vosk/v1/resource-cache.js', 'utf8') + '\nreadBuildingVoiceAsset', context) as
    (name: string, allowNetwork: boolean) => Promise<null | { bytes: ArrayBuffer; persisted: boolean; cached: boolean }>
  return { read, fetch, cache }
}
describe('verified static voice cache', () => {
  it('does not fetch on a cache-only miss and deduplicates concurrent network preparations', async () => {
    const f = fixture()
    expect(await f.read('model.tar.gz', false)).toBeNull()
    expect(f.fetch).not.toHaveBeenCalled()
    const [first, second] = await Promise.all([f.read('model.tar.gz', true), f.read('model.tar.gz', true)])
    expect(first).toMatchObject({ cached: false, persisted: true })
    expect(second).toMatchObject({ cached: true, persisted: true })
    expect(f.fetch).toHaveBeenCalledOnce()
    expect(f.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ priority: 'low', credentials: 'omit' }))
  })
  it('evicts corrupt cached bytes and fails, without a hidden redownload loop', async () => {
    const f = fixture({ corrupt: true })
    await expect(f.read('model.tar.gz', true)).rejects.toThrow('integrity')
    expect(f.cache.delete).toHaveBeenCalledOnce()
    expect(f.fetch).not.toHaveBeenCalled()
    expect(await f.read('model.tar.gz', true)).toMatchObject({ persisted: true })
    expect(f.fetch).toHaveBeenCalledOnce()
  })
  it('returns verified bytes for memory-only initialization when cache access is denied', async () => {
    const f = fixture({ noCache: true })
    const result = await f.read('model.tar.gz', true)
    expect(result).toMatchObject({ persisted: false, cached: false })
    expect(Array.from(new Uint8Array(result!.bytes))).toEqual([1, 2, 3, 4])
    expect(f.fetch).toHaveBeenCalledOnce()
  })
})
