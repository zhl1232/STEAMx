import { NextRequest, NextResponse } from 'next/server'

import { handleApiError } from '@/lib/api/auth'
import { getListedCourseCatalog } from '@/lib/api/course-catalog'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'

type RouteParams = { params: Promise<{ courseId: string }> }
const headers = { 'Cache-Control': 'private, no-store' }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { courseId: raw } = await params
  const courseId = Number(raw)
  if (!Number.isSafeInteger(courseId) || courseId <= 0) {
    return NextResponse.json({ error: 'Invalid course id' }, { status: 400, headers })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const lessons = await getListedCourseCatalog(supabase, courseId, user?.id ?? null)
    if (!lessons) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404, headers })
    }
    return NextResponse.json({ lessons }, { headers })
  } catch (error) {
    logger.error('GET /api/courses/[courseId]/catalog failed', { error, courseId })
    const response = handleApiError(error)
    response.headers.set('Cache-Control', headers['Cache-Control'])
    return response
  }
}
