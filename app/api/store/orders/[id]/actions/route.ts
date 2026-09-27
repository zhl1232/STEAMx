import { NextRequest, NextResponse } from 'next/server'
import { handleApiError, requireAuth } from '@/lib/api/auth'
import { validateUUID, ValidationError } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'
import { requireSameOrigin } from '@/lib/store/access'
import { getPrivateStoreOrder, storeRpc } from '@/lib/store/operations'
import { cancelStoreOrder } from '@/lib/store/payment-flow'
import { requestNativeRefund } from '@/lib/store/native'
export const runtime = 'nodejs'
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request)
    const user = await requireAuth(await createClient())
    const id = validateUUID((await params).id, '订单编号')
    await getPrivateStoreOrder(id, user.id)
    const body = await request.json()
    if (body.action === 'cancel') await cancelStoreOrder(id, user.id)
    else if (body.action === 'request_refund') {
      if (typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 1000) throw new ValidationError('请填写退款原因（最多1000字）')
      await requestNativeRefund({ orderId: id, userId: user.id, reason: body.reason.trim() })
    } else if (body.action === 'return_shipped' || body.action === 'confirm_delivery') {
      await storeRpc('store_native_user_action', { p_order_id: id, p_user_id: user.id, p_action: body.action, p_payload: { carrier: body.carrier, trackingNumber: body.trackingNumber } })
    } else throw new ValidationError('不支持的订单操作')
    return NextResponse.json({ ok: true })
  } catch (error) { return handleApiError(error) }
}
