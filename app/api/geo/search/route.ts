import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { logger } from '@/lib/logger'

const QuerySchema = z.object({ q: z.string().trim().min(2).max(80) })

export async function GET(request: NextRequest) {
  const parsed = QuerySchema.safeParse({ q: request.nextUrl.searchParams.get('q') })
  if (!parsed.success) return NextResponse.json({ places: [] })

  const key = process.env.AMAP_WEB_SERVICE_KEY || process.env.GAODE_WEB_SERVICE_KEY
  if (!key) return NextResponse.json({ places: [] })

  try {
    const url = new URL('https://restapi.amap.com/v3/place/text')
    url.searchParams.set('key', key)
    url.searchParams.set('keywords', parsed.data.q)
    url.searchParams.set('offset', '6')
    url.searchParams.set('page', '1')
    url.searchParams.set('extensions', 'base')
    const response = await fetch(url, { next: { revalidate: 60 * 10 } })
    const data = await response.json() as {
      status?: string
      pois?: Array<{ id?: string; name?: string; address?: string | string[]; pname?: string; cityname?: string; adname?: string; location?: string }>
    }
    const places = (data.status === '1' ? data.pois || [] : []).flatMap((poi) => {
      const coords = poi.location?.split(',').map(Number)
      if (!poi.name || !coords || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) return []
      const address = typeof poi.address === 'string' ? poi.address : ''
      return [{
        id: poi.id || `${coords[0]},${coords[1]}`,
        name: poi.name,
        address: [poi.pname, poi.cityname, poi.adname, address].filter(Boolean).join(''),
        latitude: coords[1],
        longitude: coords[0],
        coordinateSystem: 'gcj02',
      }]
    })
    return NextResponse.json({ places })
  } catch (error) {
    logger.error(error, { route: 'GET /api/geo/search' })
    return NextResponse.json({ places: [] })
  }
}
