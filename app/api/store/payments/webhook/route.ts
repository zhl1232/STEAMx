import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Retired: a shared HMAC is not evidence of a channel-confirmed payment. */
export async function POST() {
  return NextResponse.json(
    { error: '旧支付回调已停用', code: 'LEGACY_PAYMENT_WEBHOOK_DISABLED' },
    { status: 410 },
  )
}
