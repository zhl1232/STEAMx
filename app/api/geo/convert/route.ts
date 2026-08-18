import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { logger } from '@/lib/logger'
import { wgs84ToGcj02 } from '@/lib/geo/wgs84-gcj02'

const QuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
})

export async function GET(request: NextRequest) {
  const parsed = QuerySchema.safeParse({
    lat: request.nextUrl.searchParams.get('lat'),
    lng: request.nextUrl.searchParams.get('lng'),
  })
  if (!parsed.success) return NextResponse.json({ error: '坐标无效' }, { status: 400 })

  const key = process.env.AMAP_WEB_SERVICE_KEY || process.env.GAODE_WEB_SERVICE_KEY
  if (!key) {
    const converted = wgs84ToGcj02(parsed.data.lat, parsed.data.lng)
    return NextResponse.json({
      latitude: converted.latitude,
      longitude: converted.longitude,
      coordinateSystem: 'gcj02',
      provider: 'local',
    })
  }

  try {
    const url = new URL('https://restapi.amap.com/v3/assistant/coordinate/convert')
    url.searchParams.set('key', key)
    url.searchParams.set('locations', `${parsed.data.lng},${parsed.data.lat}`)
    url.searchParams.set('coordsys', 'gps')
    const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 } })
    const data = await response.json() as { status?: string; locations?: string }
    const converted = data.locations?.split(',').map(Number)
    if (data.status !== '1' || !converted || !Number.isFinite(converted[0]) || !Number.isFinite(converted[1])) {
      return NextResponse.json({ error: '坐标转换失败' }, { status: 502 })
    }
    return NextResponse.json({
      latitude: converted[1],
      longitude: converted[0],
      coordinateSystem: 'gcj02',
    })
  } catch (error) {
    logger.error(error, { route: 'GET /api/geo/convert' })
    return NextResponse.json({ error: '坐标转换失败' }, { status: 502 })
  }
}
