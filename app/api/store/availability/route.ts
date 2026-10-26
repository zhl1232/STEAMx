import { NextResponse } from 'next/server'
import { isStoreCatalogVisible } from '@/lib/store/config'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(
    { catalogVisible: isStoreCatalogVisible() },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
