/** @vitest-environment node */

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { GET } from '@/app/api/species/route'
import { getSpeciesList } from '@/lib/api/nature-observation-data'

vi.mock('@/lib/api/nature-observation-data', () => ({
  getSpeciesList: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

describe('GET /api/species', () => {
  const getSpeciesListMock = getSpeciesList as Mock<typeof getSpeciesList>

  beforeEach(() => {
    vi.clearAllMocks()
    getSpeciesListMock.mockResolvedValue({
      species: [],
      total: 0,
      hasMore: false,
      topicCounts: [],
    })
  })

  it('passes search, paging, and topic filters to the species reader', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/species?q=雀&page=2&pageSize=18&topic=birds') as never,
    )

    expect(getSpeciesListMock).toHaveBeenCalledWith({
      query: '雀',
      topic: 'birds',
      page: 2,
      pageSize: 18,
    })
    expect(response.status).toBe(200)
  })

  it('normalizes invalid topic filters to all', async () => {
    await GET(new NextRequest('http://localhost/api/species?topic=unknown') as never)

    expect(getSpeciesListMock).toHaveBeenCalledWith({
      query: undefined,
      topic: 'all',
      page: 0,
      pageSize: 12,
    })
  })
})
