import { NextRequest, NextResponse } from 'next/server'
import { handleApiError, requireRole } from '@/lib/api/auth'
import { ValidationError, validateUUID } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'
import { listAdminStoreOrders } from '@/lib/store/operations'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
function parsePage(value: string | null) {
  if (!value) return 1
  const page = Number(value)
  if (!/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(page) || page > 1_000_000)
    throw new ValidationError('订单页码无效')
  return page
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(await createClient(), ['admin'])
    const params = new URL(request.url).searchParams
    const page = parsePage(params.get('page'))
    const orderId = params.get('order') === null ? undefined : validateUUID(params.get('order'), '订单编号')
    return NextResponse.json(
      await listAdminStoreOrders(page, orderId),
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return handleApiError(error)
  }
}
