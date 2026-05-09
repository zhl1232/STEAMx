import { NextResponse } from 'next/server'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { STUDY_CHECKIN_WINDOW_DAYS, type ProfileStudyCheckInSummary } from '@/lib/profile/study-checkin'
import { callRpc } from '@/lib/supabase/rpc'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const { data, error } = await callRpc(supabase, 'get_user_study_checkin_summary', {
      target_user_id: user.id,
      window_days: STUDY_CHECKIN_WINDOW_DAYS,
    })

    if (error) {
      throw error
    }

    if (!data) {
      throw new Error('学习打卡数据为空')
    }

    return NextResponse.json(data as ProfileStudyCheckInSummary)
  } catch (error) {
    return handleApiError(error)
  }
}
