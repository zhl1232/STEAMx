import { NextResponse } from 'next/server'
import { handleApiError, requireAuth } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import { isStoreCheckoutEnabled, isStorePaymentEnabled } from '@/lib/store/config'
import { listCouponOffers } from '@/lib/store/native'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireAuth(await createClient())
    const enabled = isStoreCheckoutEnabled() && (['alipay', 'wechat'] as const).some(p => isStorePaymentEnabled(p))
    return NextResponse.json({ offers: enabled ? await listCouponOffers(user.id) : [], enabled }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleApiError(error)
  }
}
