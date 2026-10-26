import { NextResponse } from 'next/server'
import { handleApiError, requireAuth } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import { listUserStoreCoupons } from '@/lib/store/native'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    const user = await requireAuth(await createClient())
    return NextResponse.json({coupons: await listUserStoreCoupons(user.id)}, {headers: {'Cache-Control': 'no-store'}})
  } catch (error) { return handleApiError(error) }
}
