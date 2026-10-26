import { NextRequest, NextResponse } from 'next/server'
import { handleApiError, requireRole } from '@/lib/api/auth'
import { ValidationError } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'
import { requireSameOrigin } from '@/lib/store/access'
import { couponBatchSchema } from '@/lib/store/benefit-input'
import { listStoreCouponBatches, grantStoreCouponBatch } from '@/lib/store/native'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET() {
  try { await requireRole(await createClient(), ['admin']); return NextResponse.json({batches: await listStoreCouponBatches()}, {headers: {'Cache-Control': 'no-store'}}) } catch (error) { return handleApiError(error) }
}
export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const {user} = await requireRole(await createClient(), ['admin'])
    const parsed = couponBatchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw new ValidationError('请提供模板、批次幂等键和会员编号列表')
    return NextResponse.json(await grantStoreCouponBatch(parsed.data, user.id))
  } catch (error) { return handleApiError(error) }
}
