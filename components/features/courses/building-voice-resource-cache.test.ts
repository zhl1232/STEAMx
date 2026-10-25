import { readFileSync } from 'node:fs'
import { createHash, webcrypto } from 'node:crypto'
import { runInNewContext } from 'node:vm'
import { afterEach, expect, it, vi } from 'vitest'

const script = readFileSync('public/courses/vosk/v2/resource-cache.js', 'utf8')
const payload = new TextEncoder().encode('verified model fixture')
const hash = createHash('sha256').update(payload).digest('hex')
const origin = 'https://course.example'
const key = `${origin}/courses/vosk/cache/${hash}/model.tar.gz`
const legacy = `${origin}/courses/vosk/v1/model.tar.gz`
function fixture(fallback = false) {
  const entries = new Map<string, Uint8Array<ArrayBuffer>>()
  const cache = {
    match: vi.fn(async (url: string) => entries.has(url) ? new Response(entries.get(url)) : undefined),
    put: vi.fn(async (url: string, response: Response) => { entries.set(url, new Uint8Array(await response.arrayBuffer())) }),
    delete: vi.fn(async (url: string) => entries.delete(url)),
  }
  const fetch = vi.fn(async () => new Response(payload))
  const postMessage = vi.fn()
  const read = runInNewContext(`${script}; readBuildingVoiceAsset`, {
    BUILDING_VOICE_ASSETS: { 'model.tar.gz': { bytes: payload.length, sha256: hash, url: 'https://cdn.example/model.tar.gz', ...(fallback ? { fallbackUrl: '/courses/vosk/v1/model.tar.gz' } : {}) } },
    self: { location: { href: `${origin}/courses/vosk/v2/prepare-worker.js` }, navigator: {}, postMessage },
    caches: { open: async () => cache }, fetch, crypto: webcrypto, URL, Response, ReadableStream, Uint8Array, AbortController, setTimeout, clearTimeout,
  }) as (name: string, network: boolean) => Promise<{ bytes: ArrayBuffer; persisted: boolean; cached: boolean } | null>
  return { entries, cache, fetch, read, postMessage }
}
afterEach(() => vi.useRealTimers())
it('migrates verified v1 cache without downloading and survives a CDN host change', async () => {
  const f = fixture(); f.entries.set(legacy, payload)
  expect(await f.read('model.tar.gz', false)).toMatchObject({ cached: true, persisted: true })
  expect(f.fetch).not.toHaveBeenCalled()
  expect(f.entries.has(key)).toBe(true)
  expect(f.entries.has(legacy)).toBe(false)
  expect(await f.read('model.tar.gz', false)).toMatchObject({ cached: true })
})
it('rejects corrupt cache and an oversized network response without retaining partial data', async () => {
  const f = fixture(); f.entries.set(key, new Uint8Array([1]))
  f.fetch.mockImplementationOnce(async () => new Response(new Uint8Array(payload.length + 1)))
  await expect(f.read('model.tar.gz', true)).rejects.toThrow('integrity')
  expect(f.entries.size).toBe(0)
  expect(await f.read('model.tar.gz', true)).toMatchObject({ cached: false, persisted: true })
  expect(f.fetch).toHaveBeenCalledWith('https://cdn.example/model.tar.gz', expect.objectContaining({ mode: 'cors', credentials: 'omit', priority: 'low', cache: 'no-cache' }))
})
it('retains a valid legacy copy when quota prevents migration', async () => {
  const f = fixture(); f.entries.set(legacy, payload)
  f.cache.put.mockRejectedValue(new Error('quota'))
  expect(await f.read('model.tar.gz', false)).toMatchObject({ cached: true, persisted: true })
  expect(f.entries.has(legacy)).toBe(true)
  expect(f.fetch).not.toHaveBeenCalled()
})
it('does not poison cache with an interrupted stream; an explicit retry succeeds', async () => {
  const f = fixture()
  f.fetch.mockImplementationOnce(async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(payload.slice(0, 3)); controller.error(new Error('interrupted')) } })))
  await expect(f.read('model.tar.gz', true)).rejects.toThrow('interrupted')
  expect(f.entries.size).toBe(0)
  expect(await f.read('model.tar.gz', true)).toMatchObject({ cached: false })
})
it('aborts a stalled request without starting a retry loop', async () => {
  vi.useFakeTimers()
  const f = fixture()
  let aborted = false
  f.fetch.mockImplementationOnce((...args: unknown[]) => new Promise((_resolve, reject) => {
    const options = args[1] as RequestInit
    options.signal?.addEventListener('abort', () => { aborted = true; reject(new Error('stalled')) })
  }))
  const failure = expect(f.read('model.tar.gz', true)).rejects.toThrow('stalled')
  await vi.advanceTimersByTimeAsync(45_001)
  await failure
  expect(aborted).toBe(true)
  expect(f.fetch).toHaveBeenCalledOnce()
  expect(f.entries.size).toBe(0)
})
it('SW activation deletes only its own obsolete PWA caches', async () => {
  const listeners: Record<string, (event: { waitUntil: (work: Promise<unknown>) => void }) => void> = {}
  const remove = vi.fn()
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    self: { addEventListener: (name: string, handler: typeof listeners[string]) => { listeners[name] = handler }, clients: { claim: vi.fn() } },
    caches: { keys: async () => ['steamx-pwa-v0', 'steamx-pwa-v1', 'steamx-building-vosk-v1', 'other-feature'], delete: remove },
  })
  let work!: Promise<unknown>
  listeners.activate({ waitUntil: value => { work = value } }); await work
  expect(remove.mock.calls).toEqual([['steamx-pwa-v0']])
})

it('uses the original public file once when CDN is unreadable, with the same integrity requirement', async () => {
  const f = fixture(true)
  f.fetch.mockRejectedValueOnce(new TypeError('CORS'))
  expect(await f.read('model.tar.gz', true)).toMatchObject({ source: 'same-origin', cached: false })
  expect(f.fetch).toHaveBeenNthCalledWith(2, legacy, expect.objectContaining({ credentials: 'omit' }))
  expect(await f.read('model.tar.gz', false)).toMatchObject({ source: 'cache', cached: true })
  expect(f.fetch).toHaveBeenCalledTimes(2)
})
it('does not retry forever when both public sources fail or disguise an integrity failure', async () => {
  const f = fixture(true)
  f.fetch.mockRejectedValue(new Error('offline'))
  await expect(f.read('model.tar.gz', true)).rejects.toThrow('offline')
  expect(f.fetch).toHaveBeenCalledTimes(2)
  expect(f.entries.size).toBe(0)
  f.fetch.mockClear().mockImplementation(async () => new Response(new Uint8Array(payload.length)))
  await expect(f.read('model.tar.gz', true)).rejects.toThrow('integrity')
  expect(f.fetch).toHaveBeenCalledOnce()
})

it('announces the fallback transition after a CDN stall before waiting for origin headers', async () => {
  vi.useFakeTimers()
  const f = fixture(true)
  f.fetch.mockImplementationOnce((...args: unknown[]) => new Promise((_resolve, reject) => {
    const options = args[1] as RequestInit
    options.signal?.addEventListener('abort', () => reject(new Error('CDN stalled')))
  })).mockImplementationOnce(async () => {
    await new Promise(resolve => setTimeout(resolve, 30_000))
    return new Response(payload)
  })
  const result = f.read('model.tar.gz', true)
  await vi.advanceTimersByTimeAsync(45_001)
  expect(f.fetch).toHaveBeenCalledTimes(2)
  expect(f.postMessage.mock.calls.filter(([data]) => data.type === 'progress').length).toBeGreaterThanOrEqual(3)
  await vi.advanceTimersByTimeAsync(30_000)
  expect(await result).toMatchObject({ source: 'same-origin', cached: false })
})
