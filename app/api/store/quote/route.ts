import { NextRequest, NextResponse } from 'next/server'
import { handleApiError, requireAuth } from '@/lib/api/auth'
import { ValidationError } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'
import { requireSameOrigin, requireStoreCheckoutAccess } from '@/lib/store/access'
import { parseStoreItems } from '@/lib/store/http'
import { parseStoreBenefits } from '@/lib/store/benefit-input'
import { quoteNativeOrder } from '@/lib/store/native'
import { normalizeMainlandProvince } from '@/lib/store/regions'
import { isStorePaymentEnabled } from '@/lib/store/config'
import { requireRateLimit } from '@/lib/api/rate-limit'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function POST(request: NextRequest) {
  try {
    const db = await createClient()
    const user = await requireAuth(db)
    requireSameOrigin(request)
    await requireStoreCheckoutAccess(db)
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') throw new ValidationError('请求体必须是 JSON')
    const province = normalizeMainlandProvince(typeof body.province === 'string' ? body.province : '')
    if (!province) throw new ValidationError('请选择中国大陆省份')
    let items
    try { items = parseStoreItems(body.items) } catch { throw new ValidationError('请选择有效商品和数量') }
    const benefits = parseStoreBenefits(body)
    await requireRateLimit(db, {key: `store-quote:${user.id}`, limit: 60, windowMs: 60000})
    const quote = await quoteNativeOrder({userId: user.id, province, items, ...benefits})
    const paymentProviders = (['alipay','wechat'] as const).filter(provider => isStorePaymentEnabled(provider))
    return NextResponse.json({quote, paymentProviders}, {headers: {'Cache-Control': 'no-store'}})
  } catch (error) { return handleApiError(error) }
}
