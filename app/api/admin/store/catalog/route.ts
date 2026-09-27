import { NextRequest, NextResponse } from 'next/server'
import { handleApiError, requireRole } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import { listAdminStoreCatalog } from '@/lib/store/operations'
import { mapAdminCatalog } from '@/lib/store/catalog-input'
import { parseNativeCatalog } from '@/lib/store/catalog-input'
import { saveNativeCatalog } from '@/lib/store/native'
import { requireSameOrigin } from '@/lib/store/access'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET() {
  try { await requireRole(await createClient(), ['admin']); return NextResponse.json({ products: (await listAdminStoreCatalog()).map(mapAdminCatalog) }, { headers: { 'Cache-Control': 'no-store' } }) } catch (error) { return handleApiError(error) }
}
export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const { user } = await requireRole(await createClient(), ['admin'])
    const input = parseNativeCatalog(await request.json())
    const id = await saveNativeCatalog(null, { ...input, createdBy: user.id })
    return NextResponse.json({ product: { id } }, { status: 201 })
  } catch (error) { return handleApiError(error) }
}
