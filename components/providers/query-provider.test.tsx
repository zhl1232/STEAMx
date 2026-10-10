import { afterEach, describe, expect, it, vi } from 'vitest'

import { BROWSER_QUERY_GC_TIME_MS, createAppQueryClient } from './query-provider'

function buildQuery(onServer: boolean) {
  const client = createAppQueryClient(onServer)
  const query = client.getQueryCache().build(client, { queryKey: ['memleak-regression'] })
  return { client, query }
}

describe('createAppQueryClient', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('schedules no GC timer for queries created during SSR', () => {
    vi.useFakeTimers()
    const { query } = buildQuery(true)

    expect(query.gcTime).toBe(Infinity)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps the 24h idle cache in the browser', () => {
    vi.useFakeTimers()
    const { client, query } = buildQuery(false)

    expect(query.gcTime).toBe(BROWSER_QUERY_GC_TIME_MS)
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(BROWSER_QUERY_GC_TIME_MS)
    expect(client.getQueryCache().find({ queryKey: ['memleak-regression'] })).toBeUndefined()
  })
})
