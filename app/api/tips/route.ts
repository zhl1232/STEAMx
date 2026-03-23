import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { getAccessibleCompletion } from '@/lib/api/completion-access'
import { getAccessibleProject } from '@/lib/api/project-access'
import { requireRateLimit } from '@/lib/api/rate-limit'

const ALLOWED_TYPES = new Set(['project', 'completion'])

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-tips', limit: 10, windowMs: 60_000 })
    const body = await request.json()

    const resourceType = typeof body?.resourceType === 'string' ? body.resourceType : ''
    const resourceId = Number(body?.resourceId)
    const amount = Number(body?.amount)

    if (!ALLOWED_TYPES.has(resourceType) || !Number.isInteger(resourceId) || resourceId <= 0) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }
    if (Number.isNaN(amount) || !Number.isInteger(amount) || amount <= 0 || amount > 2) {
      return NextResponse.json({ error: 'Invalid amount (1–2)' }, { status: 400 })
    }

    if (resourceType === 'project') {
      const project = await getAccessibleProject(supabase, resourceId, user.id)
      if (!project) {
        return NextResponse.json({ error: '项目不存在' }, { status: 404 })
      }
    } else {
      const completion = await getAccessibleCompletion(supabase, resourceId, user.id)
      if (!completion) {
        return NextResponse.json({ error: '作品不存在' }, { status: 404 })
      }
    }

    const { data, error } = await supabase.rpc('tip_resource', {
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_amount: amount,
    } as never)

    if (error) throw error

    const result = data as { ok?: boolean; error?: string } | null
    if (!result?.ok) {
      return NextResponse.json({ ok: false, error: result?.error || 'tip_failed' }, { status: 422 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
