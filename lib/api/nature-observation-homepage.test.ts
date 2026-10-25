/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getRecentNatureObservations } from './nature-observation-homepage'

const { createPublicClient, isPlaywrightSmoke } = vi.hoisted(() => ({ createPublicClient: vi.fn(), isPlaywrightSmoke: vi.fn(() => false) }))
vi.mock('@/lib/supabase/server', () => ({ createPublicClient, createClient: vi.fn() }))
vi.mock('@/lib/testing/playwright-smoke', () => ({ isPlaywrightSmoke }))

function mockDatabase(data: unknown[], error: unknown = null) {
  createPublicClient.mockReturnValue({
    from: (table: string) => {
      const result = table === 'observation_events_public' ? { data, error } : { data: [], error: null }
      const query: Record<string, unknown> = {}
      for (const method of ['select', 'eq', 'order', 'limit', 'in']) {
        query[method] = () => query
      }
      query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
      return query
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  isPlaywrightSmoke.mockReturnValue(false)
})

describe('recent homepage observations', () => {
  it('uses the explicit smoke fixture without querying the placeholder backend', async () => {
    isPlaywrightSmoke.mockReturnValue(true)
    await expect(getRecentNatureObservations(3, { strictErrors: true })).resolves.toEqual([])
    expect(createPublicClient).not.toHaveBeenCalled()
  })
  it('includes records without coordinates and preserves hidden-location privacy', async () => {
    mockDatabase([
      { id: 1, user_id: 'a', location_precision: 'hidden', latitude: 30, longitude: 120 },
      { id: 2, user_id: 'b', latitude: null, longitude: null },
    ])
    const observations = await getRecentNatureObservations(3, { strictErrors: true })
    expect(observations.map(row => row.id)).toEqual([1, 2])
    expect(observations[0]).toMatchObject({ latitude: null, longitude: null, locationName: '位置已隐藏' })
  })

  it('does not report query failures as an empty list in strict mode', async () => {
    const error = { message: 'database unavailable' }
    mockDatabase([], error)
    await expect(getRecentNatureObservations(3, { strictErrors: true })).rejects.toEqual(error)
  })

  it('returns an empty list for a successful query with no records', async () => {
    mockDatabase([])
    await expect(getRecentNatureObservations(3, { strictErrors: true })).resolves.toEqual([])
  })
})
