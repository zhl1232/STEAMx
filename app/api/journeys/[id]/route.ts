import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateNumber } from '@/lib/api/validation'
import { getJourneyById, listJourneyRecords, updateJourney } from '@/lib/journeys/service'
import { createClient } from '@/lib/supabase/server'

const JourneyUpdateSchema = z.object({
  // Completion is set by moderation and active attempts are created by
  // ensureJourney. The client may only explicitly abandon an active attempt.
  status: z.literal('abandoned').optional(),
  project_goal: z.string().max(160).nullable().optional(),
})

function getId(value: string) {
  return validateNumber(value, 'Journey id', { min: 1, integer: true })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const journeyId = getId((await params).id)
    const journey = await getJourneyById(supabase, journeyId, user.id)
    if (!journey) return NextResponse.json({ error: 'Journey not found' }, { status: 404 })

    const records = await listJourneyRecords(supabase, journeyId, {
      limit: Number(request.nextUrl.searchParams.get('limit')) || 100,
      before: request.nextUrl.searchParams.get('before') || undefined,
    })
    return NextResponse.json({ journey, records })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireInteractionAccess(supabase, user, 'save_progress')
    await requireRateLimit(supabase, { key: 'api-journeys-update', limit: 30, windowMs: 60_000 })
    const journeyId = getId((await params).id)
    const body = await request.json().catch(() => ({}))
    const parsed = JourneyUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Journey 更新内容无效' }, { status: 400 })
    }

    const journey = await getJourneyById(supabase, journeyId, user.id)
    if (!journey) return NextResponse.json({ error: 'Journey not found' }, { status: 404 })

    const nextJourney = await updateJourney(supabase, journeyId, user.id, {
      status: parsed.data.status,
      projectGoal: parsed.data.project_goal,
    })

    return NextResponse.json({ journey: nextJourney })
  } catch (error) {
    return handleApiError(error)
  }
}
