import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { logger } from '@/lib/logger'
import { pickReadableLocationName, type AmapRegeoCode } from './location-name'

const ReverseGeoQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
})

interface AmapRegeoResponse {
  status?: string
  info?: string
  regeocode?: AmapRegeoCode
}

export async function GET(request: NextRequest) {
  const parsed = ReverseGeoQuerySchema.safeParse({
    lat: request.nextUrl.searchParams.get('lat'),
    lng: request.nextUrl.searchParams.get('lng'),
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join(', ') },
      { status: 400 },
    )
  }

  const key = process.env.AMAP_WEB_SERVICE_KEY || process.env.GAODE_WEB_SERVICE_KEY
  if (!key) {
    logger.warn('AMap reverse geocode key is not configured')
    return NextResponse.json({ name: null, provider: 'amap' })
  }

  try {
    const url = new URL('https://restapi.amap.com/v3/geocode/regeo')
    url.searchParams.set('key', key)
    url.searchParams.set('location', `${parsed.data.lng},${parsed.data.lat}`)
    url.searchParams.set('output', 'json')
    url.searchParams.set('extensions', 'all')
    url.searchParams.set('radius', '1000')
    url.searchParams.set('roadlevel', '0')

    const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 } })
    if (!response.ok) {
      logger.warn('AMap reverse geocode HTTP error', { status: response.status })
      return NextResponse.json({ name: null, provider: 'amap' }, { status: 200 })
    }

    const data = (await response.json()) as AmapRegeoResponse
    if (data.status !== '1' || !data.regeocode) {
      logger.warn('AMap reverse geocode failed', { info: data.info })
      return NextResponse.json({ name: null, provider: 'amap' }, { status: 200 })
    }

    const name = pickReadableLocationName(data.regeocode)
    return NextResponse.json({
      name,
      provider: 'amap',
    })
  } catch (error) {
    logger.error(error, { route: 'GET /api/geo/reverse' })
    return NextResponse.json({ name: null, provider: 'amap' }, { status: 200 })
  }
}
