import { NextResponse } from 'next/server'

import { listApprovedCourses } from '@/lib/api/courses'
import { handleApiError } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function GET() {
  const supabase = await createClient()

  try {
    const courses = await listApprovedCourses(supabase)
    return NextResponse.json({ courses })
  } catch (error) {
    logger.error('GET /api/courses failed', { error })
    return handleApiError(error)
  }
}
