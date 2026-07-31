import { NextResponse } from 'next/server'

import { listApprovedCourses } from '@/lib/api/courses'
import { handleApiError } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { toCourseProgressApi } from '@/lib/courses/progress'

export async function GET() {
  const supabase = await createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const courses = await listApprovedCourses(supabase, { userId: user?.id ?? null })
    const apiCourses = courses.map((course) => ({
      ...course,
      progress: course.progress ? toCourseProgressApi(course.progress) : null,
    }))
    return NextResponse.json(
      { courses: apiCourses },
      user
        ? { headers: { 'Cache-Control': 'private, no-store' } }
        : { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
    )
  } catch (error) {
    logger.error('GET /api/courses failed', { error })
    return handleApiError(error)
  }
}
