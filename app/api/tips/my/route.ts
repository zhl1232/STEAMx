import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_TYPES = new Set(['project', 'completion'])

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    const searchParams = request.nextUrl.searchParams
    const resourceType = searchParams.get('resourceType') || ''
    const resourceId = Number(searchParams.get('resourceId'))

    if (!ALLOWED_TYPES.has(resourceType) || Number.isNaN(resourceId)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ myTipped: 0 })
    }

    const { data, error } = await supabase.rpc('get_my_tip_for_resource', {
      p_resource_type: resourceType,
      p_resource_id: resourceId,
    } as never)
    if (error) throw error

    return NextResponse.json({ myTipped: (data as number) ?? 0 })
  } catch (error) {
    console.error('Error in GET /api/tips/my:', error)
    return NextResponse.json({ error: 'Failed to fetch tips' }, { status: 500 })
  }
}
