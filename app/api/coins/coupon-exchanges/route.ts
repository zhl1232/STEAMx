import { NextRequest, NextResponse } from 'next/server'
import { handleApiError, requireAuth } from '@/lib/api/auth'
import { ValidationError } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'
import { requireSameOrigin } from '@/lib/store/access'
import { isStoreCheckoutEnabled, isStorePaymentEnabled } from '@/lib/store/config'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { getCouponExchange, exchangeCoupon } from '@/lib/store/native'
import { couponExchangeSchema } from '@/lib/store/benefit-input'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'no-store' }

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(await createClient())
    const key = request.nextUrl.searchParams.get('intent')
    if (!key || key.length > 180) throw new ValidationError('兑换标识无效')
    return NextResponse.json({ exchange: await getCouponExchange(user.id, key) }, { headers })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await createClient()
    const user = await requireAuth(db)
    requireSameOrigin(request)
    const parsed = couponExchangeSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ValidationError('请重新确认兑换内容')
    // A completed intent remains recoverable after the store or offer is closed.
    const existing = await getCouponExchange(user.id, parsed.data.idempotencyKey)
    if (existing) {
      if (existing.offer_id !== parsed.data.offerId) throw new ValidationError('兑换标识已使用')
      return NextResponse.json({ exchange: existing }, { headers })
    }
    if (!isStoreCheckoutEnabled() || !(['alipay', 'wechat'] as const).some(p => isStorePaymentEnabled(p))) {
      throw new ValidationError('材料商城暂未开放兑换')
    }
    await requireRateLimit(db, { key: `coupon-exchange:${user.id}`, limit: 10, windowMs: 60000 })
    return NextResponse.json({ exchange: await exchangeCoupon(user.id, parsed.data) }, { headers })
  } catch (error) {
    return handleApiError(error)
  }
}
