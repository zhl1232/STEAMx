import { NextRequest, NextResponse } from 'next/server'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { ValidationError } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'
import { getUserStoreOrder } from '@/lib/store/service'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  try {
    const user = await requireAuth(supabase)
    const { id } = await params
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ValidationError('订单编号无效')
    const order = await getUserStoreOrder(supabase, user.id, id)
    if (!order) return NextResponse.json({ error: '订单不存在' }, { status: 404 })
    return NextResponse.json({ order })
  } catch (error) {
    return handleApiError(error)
  }
}
