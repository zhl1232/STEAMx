import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api/nature-observation-data', () => ({ getObservations: vi.fn() }))
vi.mock('./observations-list-load-more', () => ({ ObservationsListLoadMore: () => null }))

import ObservationsPage, { generateMetadata } from './page'
import { getObservations } from '@/lib/api/nature-observation-data'

describe('nature observation pagination metadata', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.mocked(getObservations).mockResolvedValue({ observations: [{ id: 1 } as never], total: 13, hasMore: true })
  })

  it('gives later pages distinct canonical URLs and titles', async () => {
    const metadata = await generateMetadata({ searchParams: Promise.resolve({ page: '1' }) })

    expect(metadata.alternates?.canonical).toBe('https://steam.bj.cn/nature/observations?page=1')
    expect(metadata.title).toEqual({ absolute: '观察记录 · 第 2 页 | 创探空间', template: '%s | 创探空间' })
    expect(getObservations).toHaveBeenCalledWith({ page: 1, pageSize: 12, strictErrors: true })
  })

  it('normalizes malformed pages to the first page canonical', async () => {
    const metadata = await generateMetadata({ searchParams: Promise.resolve({ page: '2junk' }) })

    expect(metadata.alternates?.canonical).toBe('https://steam.bj.cn/nature/observations')
    expect(metadata.title).toEqual({ absolute: '观察记录 | 创探空间', template: '%s | 创探空间' })
  })

  it('returns a true 404 for an empty later page', async () => {
    vi.mocked(getObservations).mockResolvedValueOnce({ observations: [], total: 12, hasMore: false })

    await expect(generateMetadata({ searchParams: Promise.resolve({ page: '1' }) }))
      .rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
  })

  it('renders a valid first page and uses strict observation loading', async () => {
    await ObservationsPage({ searchParams: Promise.resolve({ page: '0' }) })

    expect(getObservations).toHaveBeenCalledWith({ page: 0, pageSize: 12, strictErrors: true })
  })
})
