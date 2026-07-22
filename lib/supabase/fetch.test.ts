import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchWithSupabaseTimeout, getSupabaseFetchTimeoutMs } from './fetch'

const originalFetch = globalThis.fetch
const originalTimeout = process.env.SUPABASE_FETCH_TIMEOUT_MS

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalTimeout === undefined) delete process.env.SUPABASE_FETCH_TIMEOUT_MS
  else process.env.SUPABASE_FETCH_TIMEOUT_MS = originalTimeout
  vi.restoreAllMocks()
})

describe('fetchWithSupabaseTimeout', () => {
  it('applies a bounded configurable timeout', () => {
    process.env.SUPABASE_FETCH_TIMEOUT_MS = '100'
    expect(getSupabaseFetchTimeoutMs()).toBe(1_000)

    process.env.SUPABASE_FETCH_TIMEOUT_MS = '90000'
    expect(getSupabaseFetchTimeoutMs()).toBe(60_000)

    process.env.SUPABASE_FETCH_TIMEOUT_MS = 'invalid'
    expect(getSupabaseFetchTimeoutMs()).toBe(12_000)
  })

  it('combines the caller abort signal with the timeout signal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'))
    globalThis.fetch = fetchMock
    const controller = new AbortController()

    await fetchWithSupabaseTimeout('https://example.test', { signal: controller.signal })

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(init.signal?.aborted).toBe(false)
    controller.abort()
    expect(init.signal?.aborted).toBe(true)
  })
})
