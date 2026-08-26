import { NextRequest, NextResponse } from 'next/server'

import { requireRole, handleApiError } from '@/lib/api/auth'
import { buildAdminCandidate, getAdminContentTypes, isPublishedAdminContent, loadAdminQueueRows, mapAdminRow } from '@/lib/content-classification/admin'
import { createClient } from '@/lib/supabase/server'

function parseBoolean(value: string | null): boolean | null {
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function priority(type: string, row: Record<string, unknown>, candidate: ReturnType<typeof buildAdminCandidate>): number {
  const published = isPublishedAdminContent(type as never, row)
  const safety = candidate.safetyKeywords.length > 0
  const confidence = candidate.confidence === 'low'
  return (published ? 0 : 100) + (safety ? 0 : 10) + (confidence ? 0 : 2)
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    await requireRole(supabase, ['moderator', 'admin'])
    const params = request.nextUrl.searchParams
    const typeParam = params.get('contentType')
    const types = getAdminContentTypes(typeParam)
    if (types.length === 0) {
      return NextResponse.json({ error: 'contentType must be course, project, challenge, or all' }, { status: 400 })
    }

    const status = params.get('status')
    if (status && !['unreviewed', 'reviewed', 'all'].includes(status)) {
      return NextResponse.json({ error: 'status must be unreviewed, reviewed, or all' }, { status: 400 })
    }
    const queueStatus = (status || 'unreviewed') as 'unreviewed' | 'reviewed' | 'all'
    const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(params.get('pageSize') || '20', 10) || 20))
    const safetyFlag = parseBoolean(params.get('hasSafetyFlag'))
    const fetchLimit = Math.min(1000, page * pageSize + pageSize)

    const loaded = await Promise.all(types.map(async (type) => {
      const result = await loadAdminQueueRows(supabase, type, queueStatus, fetchLimit)
      if (result.error) throw result.error
      return result.data.map((row) => {
        const candidate = buildAdminCandidate(row)
        return {
          contentType: type,
          id: Number(row.id),
          title: row.title,
          status: row.status,
          moderationState: row.moderation_state ?? null,
          updatedAt: row.updated_at ?? row.created_at ?? null,
          classification: mapAdminRow(row),
          candidate,
          priority: priority(type, row, candidate),
        }
      })
    }))

    const allItems = loaded
      .flat()
      .filter((item) => safetyFlag === null || (item.candidate.safetyKeywords.length > 0) === safetyFlag)
      .sort((left, right) => {
        const priorityDelta = left.priority - right.priority
        if (priorityDelta !== 0) return priorityDelta
        return String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''))
      })
      .map(({ priority: _priority, ...item }) => item)
    const start = (page - 1) * pageSize

    return NextResponse.json({
      items: allItems.slice(start, start + pageSize),
      page,
      pageSize,
      total: allItems.length,
      hasMore: start + pageSize < allItems.length,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
