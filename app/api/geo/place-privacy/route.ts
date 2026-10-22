import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { resolvePlacePrivacy } from '@/lib/geo/place-privacy'

const QuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  name: z.string().max(200).optional(),
})

/** 发布前预判地点类型，用于提示「只显示大概区域」。最终分级以提交时服务端重新计算为准。 */
export async function GET(request: NextRequest) {
  const parsed = QuerySchema.safeParse({
    lat: request.nextUrl.searchParams.get('lat'),
    lng: request.nextUrl.searchParams.get('lng'),
    name: request.nextUrl.searchParams.get('name') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: '坐标无效' }, { status: 400 })
  }
  const result = await resolvePlacePrivacy({
    latitude: parsed.data.lat,
    longitude: parsed.data.lng,
    locationName: parsed.data.name,
  })
  return NextResponse.json(result, { headers: { 'Cache-Control': 'private, max-age=300' } })
}
