import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { isTransientUpstreamError } from '@/lib/api/upstream-errors'

export async function GET() {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .is('read_at', null)

    if (error) throw error

    return NextResponse.json({ count: count ?? 0 })
  } catch (error) {
    if (isTransientUpstreamError(error)) {
      return NextResponse.json(
        { count: 0, degraded: true },
        {
          headers: {
            'X-Upstream-Status': 'degraded',
          },
        }
      )
    }

    return handleApiError(error)
  }
}
