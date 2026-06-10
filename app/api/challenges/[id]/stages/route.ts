import { NextRequest, NextResponse } from 'next/server'

import { handleApiError } from '@/lib/api/auth'
import { getStageProgressByUser } from '@/lib/api/challenge-stage-progress'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const { id } = await params
    const challengeId = Number.parseInt(id, 10)
    if (Number.isNaN(challengeId)) {
      return NextResponse.json({ error: 'Invalid challenge id' }, { status: 400 })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ progress: [] })
    }

    const progress = await getStageProgressByUser(supabase, challengeId, user.id)
    return NextResponse.json({ progress })
  } catch (error) {
    return handleApiError(error)
  }
}
