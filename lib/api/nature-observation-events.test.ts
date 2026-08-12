import { describe, expect, it, vi } from 'vitest'

import { createClient } from '@/lib/supabase/server'
import { getObservations } from './nature-observation-events'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

type QueryResult = Record<string, unknown>

function buildQuery(result: QueryResult | Promise<QueryResult>) {
  const query: Record<string, unknown> = {}

  for (const method of ['match', 'order', 'range']) {
    query[method] = vi.fn(() => query)
  }

  query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)

  return query as {
    match: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    range: ReturnType<typeof vi.fn>
  }
}

function mockSupabase(
  countResult: QueryResult | Promise<QueryResult>,
  dataResult: QueryResult | Promise<QueryResult>,
) {
  const countQuery = buildQuery(countResult)
  const dataQuery = buildQuery(dataResult)
  const select = vi.fn((_fields: string, options?: { head?: boolean }) =>
    options?.head ? countQuery : dataQuery,
  )

  vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => ({ select })) } as never)

  return { countQuery, dataQuery, select }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('getObservations pagination', () => {
  it('reports an empty page with the real total when the range is past the last row', async () => {
    const { dataQuery } = mockSupabase(
      { count: 10, error: null },
      { data: null, error: { code: 'PGRST103', message: 'Requested range not satisfiable' } },
    )

    await expect(getObservations({ page: 1, pageSize: 12 })).resolves.toEqual({
      observations: [],
      total: 10,
      hasMore: false,
    })
    expect(dataQuery.range).toHaveBeenCalledWith(12, 23)
  })

  it('issues the page query without waiting for the count query', async () => {
    let releaseCount = () => {}
    const countResult = new Promise<QueryResult>((resolve) => {
      releaseCount = () => resolve({ count: 10, error: null })
    })
    const { dataQuery } = mockSupabase(countResult, { data: [], error: null })

    const pending = getObservations({ page: 0, pageSize: 12 })
    await flush()

    expect(dataQuery.range).toHaveBeenCalledWith(0, 11)

    releaseCount()
    await expect(pending).resolves.toMatchObject({ observations: [], total: 10 })
  })
})
