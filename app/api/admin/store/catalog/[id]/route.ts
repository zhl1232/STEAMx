import { NextRequest, NextResponse } from 'next/server'
import { handleApiError, requireRole } from '@/lib/api/auth'
import { validateUUID } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'
import { parseNativeCatalog } from '@/lib/store/catalog-input'
import { saveNativeCatalog } from '@/lib/store/native'
import { requireSameOrigin } from '@/lib/store/access'
export const runtime = 'nodejs'
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request)
    await requireRole(await createClient(), ['admin'])
    const id = validateUUID((await params).id, '商品编号')
    await saveNativeCatalog(id, parseNativeCatalog(await request.json()))
    return NextResponse.json({ product: { id } })
  } catch (error) { return handleApiError(error) }
}
