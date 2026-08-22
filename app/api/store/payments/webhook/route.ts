import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

import { handleApiError } from '@/lib/api/auth'
import { markStoreOrderPaid } from '@/lib/store/service'

export const dynamic = 'force-dynamic'

function verifySignature(rawBody: string, signature: string | null) {
  const secret = process.env.STORE_PAYMENT_WEBHOOK_SECRET?.trim()
  if (!secret || !signature) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const left = Buffer.from(expected, 'utf8')
  const right = Buffer.from(signature.replace(/^sha256=/, '').trim(), 'utf8')
  return left.length === right.length && timingSafeEqual(left, right)
}

/** Provider webhook boundary. Configure a provider and secret before enabling. */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  if (!process.env.STORE_PAYMENT_WEBHOOK_SECRET) {
    return NextResponse.json({ error: '支付回调尚未配置', code: 'PAYMENT_WEBHOOK_NOT_CONFIGURED' }, { status: 503 })
  }
  if (!verifySignature(rawBody, request.headers.get('x-store-signature'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  try {
    const body = JSON.parse(rawBody) as Record<string, unknown>
    const orderId = typeof body.order_id === 'string' ? body.order_id : typeof body.orderId === 'string' ? body.orderId : ''
    const status = body.status
    const reference = typeof body.reference === 'string' ? body.reference : typeof body.payment_reference === 'string' ? body.payment_reference : ''
    const provider = typeof body.provider === 'string' ? body.provider : 'configured'
    if (!/^[0-9a-f-]{36}$/i.test(orderId) || status !== 'paid' || !reference) {
      return NextResponse.json({ error: 'Invalid payment event' }, { status: 400 })
    }
    const confirmed = await markStoreOrderPaid(orderId, provider.slice(0, 80), reference.slice(0, 180))
    return NextResponse.json({ ok: true, confirmed })
  } catch (error) {
    return handleApiError(error)
  }
}
