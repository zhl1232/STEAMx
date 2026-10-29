import { NextRequest, NextResponse } from 'next/server'
import { handleApiError, requireRole } from '@/lib/api/auth'
import { ValidationError } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'
import { requireSameOrigin } from '@/lib/store/access'
import { listCouponOffers, saveCouponOffer } from '@/lib/store/native'
import { couponOfferSchema } from '@/lib/store/benefit-input'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'no-store' }

export async function GET() {
  try {
    await requireRole(await createClient(), ['admin'])
    return NextResponse.json({ offers: await listCouponOffers() }, { headers })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    await requireRole(await createClient(), ['admin'])
    const parsed = couponOfferSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ValidationError('请配置兑换硬币、发行上限和每人限兑数量')
    return NextResponse.json({ offer: await saveCouponOffer(parsed.data) }, { headers })
  } catch (error) {
    return handleApiError(error)
  }
}
