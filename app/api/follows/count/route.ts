import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/api/auth'
import { validateUUID } from '@/lib/api/validation'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    const targetUserId = validateUUID(
      request.nextUrl.searchParams.get('targetUserId') || '',
      'targetUserId'
    )

    const { count, error } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', targetUserId)

    if (error) throw error

    return NextResponse.json({ count: count ?? 0 })
  } catch (error) {
    return handleApiError(error)
  }
}
