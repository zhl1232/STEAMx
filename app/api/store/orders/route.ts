import { NextRequest, NextResponse } from 'next/server'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { ValidationError } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'
import { parseStoreAddress, parseStoreItems } from '@/lib/store/http'
import { getUserStoreOrder, listUserStoreOrders } from '@/lib/store/service'
import { createNativeOrder } from '@/lib/store/native'
import { normalizeMainlandProvince } from '@/lib/store/regions'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { requireStoreCheckoutAccess, requireSameOrigin } from '@/lib/store/access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const supabase = await createClient()
  try {
    const user = await requireAuth(supabase)
    return NextResponse.json({ orders: await listUserStoreOrders(supabase, user.id) })
  } catch (error) {
    return handleApiError(error)
  }
}

/** Create a local pending-payment order. Payment confirmation is webhook-only. */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  try {
    const user = await requireAuth(supabase)
    requireSameOrigin(request)
    await requireStoreCheckoutAccess(supabase)
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    if (!body) throw new ValidationError('请求体必须是 JSON')
    let items
    let address
    try {
      items = parseStoreItems(body.items)
      if (items.length !== 1) throw new Error('每笔订单只能购买一种商品规格')
      address = parseStoreAddress(body.address)
    } catch (error) {
      throw new ValidationError(error instanceof Error ? error.message : '订单参数格式错误')
    }
    const headerKey = request.headers.get('idempotency-key')
    const bodyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined
    const idempotencyKey = (headerKey || bodyKey || '').trim() || undefined
    if (idempotencyKey && idempotencyKey.length > 180) throw new ValidationError('幂等键过长')

    if (!idempotencyKey) throw new ValidationError('请提供订单幂等键')
    const province = normalizeMainlandProvince(address.province)
    if (!province) throw new ValidationError('请选择中国大陆省份')
    await requireRateLimit(supabase, { key: `store-order:${user.id}`, limit: 10, windowMs: 60000 })
    const created = await createNativeOrder({ userId: user.id, idempotencyKey, items, address: { ...address, province }, province })
    const order = await getUserStoreOrder(supabase, user.id, created.orderId)
    return NextResponse.json({ order }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
