import { NextRequest, NextResponse } from 'next/server'
import { handleApiError, requireRole } from '@/lib/api/auth'
import { ValidationError } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'
import { requireSameOrigin } from '@/lib/store/access'
import { couponTemplateSchema } from '@/lib/store/benefit-input'
import { listStoreCouponTemplates, saveStoreCouponTemplate } from '@/lib/store/native'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET() {
  try { await requireRole(await createClient(), ['admin']); return NextResponse.json({templates: await listStoreCouponTemplates()}, {headers: {'Cache-Control': 'no-store'}}) } catch (error) { return handleApiError(error) }
}
export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const {user} = await requireRole(await createClient(), ['admin'])
    const parsed = couponTemplateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ValidationError('请配置优惠券标题、门槛、金额、有效天数及条款')
    return NextResponse.json({template: await saveStoreCouponTemplate(parsed.data, user.id)})
  } catch (error) { return handleApiError(error) }
}
