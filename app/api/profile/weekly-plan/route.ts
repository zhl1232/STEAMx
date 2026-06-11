import { NextResponse } from 'next/server'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { getWeeklyPlanData } from '@/lib/api/weekly-plan-data'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const plan = await getWeeklyPlanData(supabase, user.id)

    return NextResponse.json({ plan })
  } catch (error) {
    logger.error('Error in GET /api/profile/weekly-plan', { error })
    return handleApiError(error)
  }
}
