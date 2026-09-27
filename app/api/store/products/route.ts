import { NextResponse } from 'next/server'
import { validateUUID } from '@/lib/api/validation'
import { handleApiError } from '@/lib/api/auth'
import { isStoreCatalogVisible } from '@/lib/store/config'
import { listPublicNativeProducts } from '@/lib/store/operations'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(request: Request) {
  if (!isStoreCatalogVisible()) return NextResponse.json({ products: [] }, { headers: { 'Cache-Control': 'no-store' } })
  try {
    const requestedId = new URL(request.url).searchParams.get('product')
    const productId = requestedId === null ? undefined : validateUUID(requestedId, '商品编号')
    return NextResponse.json({ products: await listPublicNativeProducts(productId) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return handleApiError(error) }
}
