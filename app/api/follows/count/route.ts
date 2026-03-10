import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    const targetUserId = request.nextUrl.searchParams.get('targetUserId') || ''
    if (!targetUserId) {
      return NextResponse.json({ error: 'Invalid target user' }, { status: 400 })
    }

    const { count, error } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', targetUserId)

    if (error) throw error

    return NextResponse.json({ count: count ?? 0 })
  } catch (error) {
    console.error('Error in GET /api/follows/count:', error)
    return NextResponse.json({ error: 'Failed to fetch follower count' }, { status: 500 })
  }
}
