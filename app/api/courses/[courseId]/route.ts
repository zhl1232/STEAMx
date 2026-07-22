import { NextRequest, NextResponse } from 'next/server'

import { getCourseOverview } from '@/lib/api/courses'
import { handleApiError } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

type RouteParams = { params: Promise<{ courseId: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { courseId: courseIdRaw } = await params
  const courseId = Number(courseIdRaw)

  if (!Number.isFinite(courseId) || courseId <= 0) {
    return NextResponse.json({ error: 'Invalid course id' }, { status: 400 })
  }

  try {
    const course = await getCourseOverview(supabase, courseId)
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }
    return NextResponse.json({ course })
  } catch (error) {
    logger.error('GET /api/courses/[courseId] failed', { error, courseId })
    return handleApiError(error)
  }
}
