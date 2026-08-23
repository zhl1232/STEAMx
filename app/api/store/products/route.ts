import { NextRequest, NextResponse } from 'next/server'

import { handleApiError } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import { listStoreProducts, mapPublicStoreProduct } from '@/lib/store/service'

export const dynamic = 'force-dynamic'

/** GET /api/store/products - active physical-goods catalog (separate from /shop coins). */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const rawLimit = Number(request.nextUrl.searchParams.get('limit') || 24)
    const limit = Number.isFinite(rawLimit) ? rawLimit : 24
    const products = await listStoreProducts(supabase, {
      limit,
      search: request.nextUrl.searchParams.get('search') || undefined,
    })
    // 1688 offer/spec、供应商和 metadata 只供服务端报价和下单，不能随商品目录返回浏览器。
    return NextResponse.json({ products: products.map(mapPublicStoreProduct) })
  } catch (error) {
    return handleApiError(error)
  }
}
