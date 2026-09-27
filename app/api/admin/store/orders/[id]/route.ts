import { NextResponse } from 'next/server'
import { handleApiError, requireRole } from '@/lib/api/auth'
import { validateUUID } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'
import { getPrivateStoreOrder } from '@/lib/store/operations'
import { decryptStoreAddress } from '@/lib/store/address-crypto'
export const runtime = 'nodejs'
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(await createClient(), ['admin'])
    const order = await getPrivateStoreOrder(validateUUID((await params).id, '订单编号'))
    return NextResponse.json({ address: decryptStoreAddress(order.address_snapshot_encrypted) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return handleApiError(error) }
}
