import { NextRequest, NextResponse } from 'next/server'

import {
  isValidLdrawModelName,
  LdrawBomBusyError,
  loadLdrawBom,
} from '@/lib/courses/ldraw-bom-source'

export const runtime = 'nodejs'

/** 大颗粒课程零件清单：按模型 `0 STEP` 给出每步新增零件与整课总数。 */
export async function GET(request: NextRequest) {
  const model = request.nextUrl.searchParams.get('model') ?? ''

  if (!isValidLdrawModelName(model)) {
    return NextResponse.json({ error: 'Invalid LDraw model name' }, { status: 400 })
  }

  try {
    const bom = await loadLdrawBom(model)
    return NextResponse.json(bom, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    if (error instanceof LdrawBomBusyError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503, headers: { 'Retry-After': '1' } },
      )
    }
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'LDraw model not found' }, { status: 404 })
    }
    if (error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 413 })
    }
    return NextResponse.json({ error: 'Unable to build LDraw part list' }, { status: 500 })
  }
}
