import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET } from './route'

describe('GET /api/geo/search', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('passes the current map center to AMap and keeps nearest results first', async () => {
    vi.stubEnv('AMAP_WEB_SERVICE_KEY', 'test-key')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      status: '1',
      pois: [
        { id: 'far', name: '远处公园', address: '远处', pname: '上海市', cityname: '上海市', adname: '浦东新区', location: '121.50,31.25', distance: '800' },
        { id: 'near', name: '附近公园', address: '附近', pname: '上海市', cityname: '上海市', adname: '浦东新区', location: '121.47,31.23', distance: '40' },
      ],
    })))

    const response = await GET(new NextRequest('http://localhost/api/geo/search?q=公园&lat=31.23&lng=121.47'))
    const payload = await response.json()
    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]))

    expect(requestUrl.searchParams.get('location')).toBe('121.47,31.23')
    expect(requestUrl.searchParams.get('sortrule')).toBe('distance')
    expect(payload.places.map((place: { id: string }) => place.id)).toEqual(['near', 'far'])
  })
})
