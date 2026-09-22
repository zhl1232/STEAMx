import { afterEach, describe, expect, it, vi } from 'vitest'

import { createClient } from '@/lib/supabase/server'
import { getSpeciesBySlug } from './nature-observation-species'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

describe('getSpeciesBySlug', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('propagates primary query failures instead of turning them into a 404', async () => {
    const error = { code: 'PGRST000', message: 'database unavailable' }
    const query: Record<string, unknown> = {}
    for (const method of ['eq', 'in']) query[method] = vi.fn(() => query)
    query.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error }))

    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn(() => ({ select: vi.fn(() => query) })),
    } as never)

    await expect(getSpeciesBySlug('missing-species')).rejects.toEqual(error)
  })

  it('returns null for a genuine missing species row', async () => {
    const query: Record<string, unknown> = {}
    for (const method of ['eq', 'in']) query[method] = vi.fn(() => query)
    query.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn(() => ({ select: vi.fn(() => query) })),
    } as never)

    await expect(getSpeciesBySlug('truly-missing-species')).resolves.toBeNull()
  })

  it('does not expose species outside the three public topics', async () => {
    const query: Record<string, unknown> = {}
    for (const method of ['eq', 'in']) query[method] = vi.fn(() => query)
    query.maybeSingle = vi.fn(() => Promise.resolve({
      data: {
        id: 7,
        slug: 'fungus-slug',
        nature_topic: 'fungi',
      },
      error: null,
    }))
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn(() => ({ select: vi.fn(() => query) })),
    } as never)

    await expect(getSpeciesBySlug('fungus-slug')).resolves.toBeNull()
    expect(query.in).toHaveBeenCalledWith('nature_topic', ['birds', 'insects', 'plants'])
  })

  it('skips the database in the smoke fixture', async () => {
    vi.stubEnv('PLAYWRIGHT_SMOKE', '1')

    await expect(getSpeciesBySlug('smoke-missing-species')).resolves.toBeNull()
    expect(createClient).not.toHaveBeenCalled()
  })
})
