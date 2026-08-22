import { NextRequest, NextResponse } from 'next/server'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { ValidationError } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'

/**
 * Payment initiation is intentionally disabled until a real provider is configured.
 * Clients must never call mark_store_order_paid directly.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  try {
    await requireAuth(supabase)
    const { id } = await params
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ValidationError('订单编号无效')
    return NextResponse.json(
      { error: '支付通道尚未配置，请稍后再试', code: 'PAYMENT_PROVIDER_NOT_CONFIGURED' },
      { status: 503 },
    )
  } catch (error) {
    return handleApiError(error)
  }
}
