import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api/auth'
import { validateUUID } from '@/lib/api/validation'
import { isStoreCatalogVisible } from '@/lib/store/config'
import { listPublicNativeProducts } from '@/lib/store/operations'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(_request: Request, {params}: {params: Promise<{id: string}>}) {
  if (!isStoreCatalogVisible()) return NextResponse.json({error: '商品不可用'}, {status: 404})
  try {
    const product = (await listPublicNativeProducts(validateUUID((await params).id, '商品编号')))[0]
    if (!product) return NextResponse.json({error: '商品不可用'}, {status: 404})
    return NextResponse.json({product}, {headers: {'Cache-Control': 'no-store'}})
  } catch (error) { return handleApiError(error) }
}
