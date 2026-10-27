import { NextRequest, NextResponse } from 'next/server'
import { handleApiError, requireRole } from '@/lib/api/auth'
import { validateUUID, ValidationError } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'
import { requireSameOrigin } from '@/lib/store/access'
import { storeRpc } from '@/lib/store/operations'
import { encryptStoreAddress } from '@/lib/store/address-crypto'
import { processStoreRefund, restartStoreRefund } from '@/lib/store/payment-flow'
export const runtime = 'nodejs'
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request)
    const { user } = await requireRole(await createClient(), ['admin'])
    const id = validateUUID((await params).id, '订单编号')
    const body = await request.json()
    const allowed = ['record_procurement','ship','approve_refund','require_return','reject_refund','receive_return','retry_refund','restart_refund']
    if (!allowed.includes(body.action)) throw new ValidationError('不支持的运营操作')
    const payload: Record<string, unknown> = { reference: body.reference, costCents: body.costCents, notes: body.notes, carrier: body.carrier, trackingNumber: body.trackingNumber, reason: body.reason }
    if (body.action === 'require_return') {
      if (typeof body.returnAddress !== 'string' || !body.returnAddress.trim() || body.returnAddress.length > 2000) throw new ValidationError('请填写完整退货收件人、电话和地址')
      payload.returnAddressEncrypted = encryptStoreAddress({ recipientName: '退货收件信息', phone: '', province: '', city: '', district: '', street: body.returnAddress.trim() })
    }
    if (body.action === 'restart_refund') {
      if (typeof body.expectedRefundReference !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(body.expectedRefundReference)) throw new ValidationError('请刷新订单后核对要重新处理的退款')
      const state = await restartStoreRefund(id, body.expectedRefundReference, user.id)
      return NextResponse.json({ ok: true, state, pending: state !== 'refunded' })
    }
    if (body.action !== 'retry_refund') await storeRpc('store_native_admin_action', { p_order_id: id, p_action: body.action, p_payload: payload, p_actor_id: user.id })
    if (['approve_refund','receive_return','retry_refund','restart_refund'].includes(body.action)) {
      try {
        const state = await processStoreRefund(id, true)
        if (state === 'closed' || state === 'abnormal') return NextResponse.json({ ok: true, pending: true, state, message: state === 'closed' ? '渠道退款已关闭，请核查后重新发起退款。' : '退款异常，请前往微信商户平台处理，系统将继续查询结果。' }, { status: 202 })
      } catch {
        return NextResponse.json({ ok: true, pending: true, message: '审核已保存，退款结果待确认；后台将继续对账。' }, { status: 202 })
      }
    }
    return NextResponse.json({ ok: true })
  } catch (error) { return handleApiError(error) }
}
