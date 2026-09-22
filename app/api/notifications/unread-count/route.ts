import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { isTransientUpstreamError } from '@/lib/api/upstream-errors'

export async function GET() {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const categories = { system: ['system'], replies: ['reply', 'mention', 'creator_update'], likes: ['like', 'tip'], follows: ['follow'] } as const
    const entries = await Promise.all(Object.entries(categories).map(async ([category, types]) => {
      const result = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false).in('type', [...types])
      if (result.error) throw result.error
      return [category, result.count ?? 0] as const
    }))
    const countsByCategory = Object.fromEntries(entries) as Record<keyof typeof categories, number>
    const count = Object.values(countsByCategory).reduce((sum, value) => sum + value, 0)
    return NextResponse.json({ count, countsByCategory })
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
