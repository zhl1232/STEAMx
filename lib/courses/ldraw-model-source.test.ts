import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import {
  LdrawModelMissingError,
  LdrawModelUnavailableError,
  LdrawModelTooLargeError,
  LdrawModelInvalidError,
  LdrawModelBusyError,
  isValidLdrawModelName,
  readLdrawModel,
} from '@/lib/courses/ldraw-model-source'
import { loadLdrawBom } from '@/lib/courses/ldraw-bom-source'

const valid = '0 FILE remote.mpd\n1 4 0 0 0 1 0 0 0 1 0 0 0 0 1 part.dat\n'

function largeValidModel(name: string, targetBytes = 4 * 1024 * 1024): string {
  const prefix = `0 FILE ${name}\n1 14 0 0 0 1 0 0 0 1 0 0 0 0 1 3001.dat\n`
  const line = '0 cache padding for deterministic eviction\n'
  const padding = line.repeat(Math.max(0, Math.ceil((targetBytes - prefix.length) / line.length)))
  return prefix + padding
}

describe('LDraw model source', () => {
  afterEach(() => { delete process.env.NEXT_PUBLIC_ASSETS_BASE_URL; vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('loads remote-only models and supplies a content hash', async () => {
    process.env.NEXT_PUBLIC_ASSETS_BASE_URL = 'https://assets.example.test'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(valid)))
    const result = await readLdrawModel('remote-only.mpd')
    expect(result.source).toBe('remote')
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/)
  })

  it('distinguishes remote missing from temporary failure when no local fallback exists', async () => {
    process.env.NEXT_PUBLIC_ASSETS_BASE_URL = 'https://assets.example.test'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(readLdrawModel('unavailable-unique.mpd')).rejects.toBeInstanceOf(LdrawModelUnavailableError)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })))
    await expect(readLdrawModel('missing-unique.mpd')).rejects.toBeInstanceOf(LdrawModelMissingError)
  })

  it('rejects HTML payloads as unavailable model data', async () => {
    process.env.NEXT_PUBLIC_ASSETS_BASE_URL = 'https://assets.example.test'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>403</html>')))
    await expect(readLdrawModel('html-unique.mpd')).rejects.toBeInstanceOf(LdrawModelUnavailableError)
  })

  it('prefers an existing local MPD without contacting OSS', async () => {
    process.env.NEXT_PUBLIC_ASSETS_BASE_URL = 'https://assets.example.test'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const result = await readLdrawModel('3-hu-die.mpd')
    expect(result.source).toBe('local')
    expect(result.text).toContain('0 FILE')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('resolves a hashed name to matching local source bytes, including cached reads', async () => {
    process.env.NEXT_PUBLIC_ASSETS_BASE_URL = 'https://assets.example.test'
    const bytes = await readFile('public/courses/ldraw/3-ai-fei-er-tie-ta.mpd')
    const hash = createHash('sha256').update(bytes).digest('hex')
    const model = `3-ai-fei-er-tie-ta-${hash}.mpd`
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('must not fetch')))

    const result = await readLdrawModel(model)
    expect(result).toMatchObject({ model, source: 'local', sha256: hash, text: bytes.toString() })
    expect(await readLdrawModel(model)).toBe(result)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects mismatching local source bytes and fetches the requested immutable version', async () => {
    process.env.NEXT_PUBLIC_ASSETS_BASE_URL = 'https://assets.example.test'
    const hash = createHash('sha256').update(valid).digest('hex')
    const model = `3-ai-fei-er-tie-ta-${hash}.mpd`
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(valid)))

    expect(await readLdrawModel(model)).toMatchObject({ model, source: 'remote', sha256: hash, text: valid })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(`https://assets.example.test/courses/ldraw/${model}`, expect.any(Object))
  })

  it.each(['../escape.mpd', 'nested/escape.mpd', 'model.txt', '.hidden.mpd', ''])('rejects unsafe model names (%s)', async (model) => {
    expect(isValidLdrawModelName(model)).toBe(false)
    await expect(readLdrawModel(model)).rejects.toBeInstanceOf(LdrawModelInvalidError)
  })

  it('preserves 404 as missing while mapping a remote 503 to unavailable', async () => {
    process.env.NEXT_PUBLIC_ASSETS_BASE_URL = 'https://assets.example.test'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(readLdrawModel('missing-status-unique.mpd')).rejects.toBeInstanceOf(LdrawModelMissingError)
    await expect(readLdrawModel('unavailable-status-unique.mpd')).rejects.toBeInstanceOf(LdrawModelUnavailableError)
  })

  it('rejects a declared payload larger than 16 MiB before consuming its body', async () => {
    process.env.NEXT_PUBLIC_ASSETS_BASE_URL = 'https://assets.example.test'
    const cancel = vi.fn()
    const body = { getReader: () => ({ cancel, read: vi.fn(), releaseLock: vi.fn() }) }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body as unknown as BodyInit, {
      status: 200,
      headers: { 'content-length': String(16 * 1024 * 1024 + 1) },
    })))

    await expect(readLdrawModel('declared-large-unique.mpd')).rejects.toBeInstanceOf(LdrawModelTooLargeError)
    expect(cancel).not.toHaveBeenCalled()
  })

  it('rejects a streamed payload as soon as it crosses 16 MiB and cancels the reader', async () => {
    process.env.NEXT_PUBLIC_ASSETS_BASE_URL = 'https://assets.example.test'
    const cancel = vi.fn().mockResolvedValue(undefined)
    let reads = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        reads += 1
        if (reads === 1) controller.enqueue(new Uint8Array(16 * 1024 * 1024))
        else controller.enqueue(new Uint8Array(1))
      },
      cancel,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)))

    await expect(readLdrawModel('stream-large-unique.mpd')).rejects.toBeInstanceOf(LdrawModelTooLargeError)
    expect(cancel).toHaveBeenCalled()
  })

  it('aborts a stalled remote body at the request timeout', async () => {
    process.env.NEXT_PUBLIC_ASSETS_BASE_URL = 'https://assets.example.test'
    vi.useFakeTimers()
    const fetchMock = vi.fn((_: string, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    }))
    vi.stubGlobal('fetch', fetchMock)

    const pending = expect(readLdrawModel('timeout-unique.mpd')).rejects.toBeInstanceOf(LdrawModelUnavailableError)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await vi.advanceTimersByTimeAsync(12_000)
    await pending
    expect(fetchMock).toHaveBeenCalled()
  })

  it('deduplicates same-model remote loads and caps distinct loads at four', async () => {
    process.env.NEXT_PUBLIC_ASSETS_BASE_URL = 'https://assets.example.test'
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const fetchMock = vi.fn().mockImplementation(async () => {
      await gate
      return new Response(valid)
    })
    vi.stubGlobal('fetch', fetchMock)

    const sameA = readLdrawModel('dedupe-unique.mpd')
    const sameB = readLdrawModel('dedupe-unique.mpd')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    release()
    await Promise.all([sameA, sameB])

    const four = ['one', 'two', 'three', 'four'].map((name) => readLdrawModel(`limit-${name}-unique.mpd`))
    await expect(readLdrawModel('limit-fifth-unique.mpd')).rejects.toBeInstanceOf(LdrawModelBusyError)
    release()
    await Promise.all(four)
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it('accepts immutable filename hashes and rejects mismatches', async () => {
    process.env.NEXT_PUBLIC_ASSETS_BASE_URL = 'https://assets.example.test'
    const bytes = new TextEncoder().encode(valid)
    const hash = createHash('sha256').update(bytes).digest('hex')
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(bytes))
      .mockResolvedValueOnce(new Response(bytes)))

    const result = await readLdrawModel(`model-${hash}.mpd`)
    expect(result.sha256).toBe(hash)
    await expect(readLdrawModel(`model-${'0'.repeat(64)}.mpd`)).rejects.toBeInstanceOf(LdrawModelUnavailableError)
  })

  it('does not reuse a cached response after the asset base changes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(valid.replace('remote.mpd', 'base-a.mpd')))
      .mockResolvedValueOnce(new Response(valid.replace('remote.mpd', 'base-b.mpd')))
    vi.stubGlobal('fetch', fetchMock)
    process.env.NEXT_PUBLIC_ASSETS_BASE_URL = 'https://a.example.test'
    expect((await readLdrawModel('base-switch-unique.mpd')).source).toBe('remote')
    process.env.NEXT_PUBLIC_ASSETS_BASE_URL = 'https://b.example.test'
    expect((await readLdrawModel('base-switch-unique.mpd')).source).toBe('remote')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('evicts the oldest cached model when the 64MiB byte budget is exceeded', async () => {
    process.env.NEXT_PUBLIC_ASSETS_BASE_URL = 'https://assets.example.test'
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      const model = decodeURIComponent(url.split('/').pop() ?? 'model.mpd')
      return new Response(largeValidModel(model))
    })
    vi.stubGlobal('fetch', fetchMock)

    const models = Array.from({ length: 9 }, (_, index) => `eviction-${index}-unique.mpd`)
    for (const model of models) await readLdrawModel(model)
    await readLdrawModel(models[8])
    await readLdrawModel(models[0])

    expect(fetchMock).toHaveBeenCalledTimes(10)
  })

  it('replacing an expired entry under the same key does not leave phantom byte accounting', async () => {
    process.env.NEXT_PUBLIC_ASSETS_BASE_URL = 'https://assets.example.test'
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(largeValidModel('refresh-unique.mpd')))
      .mockResolvedValueOnce(new Response(largeValidModel('refresh-unique.mpd').replace('3001.dat', '3002.dat')))
      .mockResolvedValueOnce(new Response(largeValidModel('sibling-unique.mpd')))
    vi.stubGlobal('fetch', fetchMock)

    await readLdrawModel('refresh-unique.mpd')
    vi.setSystemTime(new Date('2026-01-01T00:01:01Z'))
    await readLdrawModel('refresh-unique.mpd')
    await readLdrawModel('sibling-unique.mpd')
    await readLdrawModel('refresh-unique.mpd')
    await readLdrawModel('sibling-unique.mpd')

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('rebuilds BOM after remote TTL expiry when the same model receives new content', async () => {
    process.env.NEXT_PUBLIC_ASSETS_BASE_URL = 'https://assets.example.test'
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const first = '0 FILE bom-refresh-unique.mpd\n0 STEP\n1 14 0 0 0 1 0 0 0 1 0 0 0 0 1 3001.dat\n'
    const second = first.replace('0 STEP\n', '0 STEP\n1 14 80 0 0 1 0 0 0 1 0 0 0 0 1 3001.dat\n')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(first))
      .mockResolvedValueOnce(new Response(second))
    vi.stubGlobal('fetch', fetchMock)

    expect((await loadLdrawBom('bom-refresh-unique.mpd')).partCount).toBe(1)
    vi.setSystemTime(new Date('2026-01-01T00:01:01Z'))
    expect((await loadLdrawBom('bom-refresh-unique.mpd')).partCount).toBe(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
