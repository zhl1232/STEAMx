import { NextRequest, NextResponse } from 'next/server'
import { getAccessibleCompletion } from '@/lib/api/completion-access'
import { getAccessibleProject } from '@/lib/api/project-access'
import { createClient } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'

const ALLOWED_TYPES = new Set(['project', 'completion'])

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    await requireRateLimit(supabase, { key: 'api-tips-my', limit: 30, windowMs: 60_000 })
    const searchParams = request.nextUrl.searchParams
    const resourceType = searchParams.get('resourceType') || ''
    const resourceId = Number(searchParams.get('resourceId'))

    if (!ALLOWED_TYPES.has(resourceType) || !Number.isInteger(resourceId) || resourceId <= 0) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (resourceType === 'project') {
      const project = await getAccessibleProject(supabase, resourceId, user?.id)
      if (!project) {
        return NextResponse.json({ error: '项目不存在' }, { status: 404 })
      }
    } else {
      const completion = await getAccessibleCompletion(supabase, resourceId, user?.id)
      if (!completion) {
        return NextResponse.json({ error: '作品不存在' }, { status: 404 })
      }
    }

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
    return handleApiError(error)
  }
}
