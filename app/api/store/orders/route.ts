import { NextRequest, NextResponse } from 'next/server'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { ValidationError } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'
import { parseStoreAddress, parseStoreItems } from '@/lib/store/http'
import { createStoreOrder, listUserStoreOrders } from '@/lib/store/service'

export const dynamic = 'force-dynamic'

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
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    if (!body) throw new ValidationError('请求体必须是 JSON')
    let items
    let address
    try {
      items = parseStoreItems(body.items)
      address = parseStoreAddress(body.address)
    } catch (error) {
      throw new ValidationError(error instanceof Error ? error.message : '订单参数格式错误')
    }
    const headerKey = request.headers.get('idempotency-key')
    const bodyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined
    const idempotencyKey = (headerKey || bodyKey || '').trim() || undefined
    if (idempotencyKey && idempotencyKey.length > 180) throw new ValidationError('幂等键过长')

    const order = await createStoreOrder({ userId: user.id, idempotencyKey, items, address })
    return NextResponse.json({ order }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
