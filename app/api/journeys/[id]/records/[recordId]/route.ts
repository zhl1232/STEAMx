import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateNumber } from '@/lib/api/validation'
import { getJourneyById, publishJourneyRecord, removeJourneyRecord } from '@/lib/journeys/service'
import { queueJourneyRecordModeration } from '@/lib/journeys/moderation'
import { createClient } from '@/lib/supabase/server'

const VisibilitySchema = z.object({ visibility: z.enum(['private', 'public']) })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; recordId: string }> },
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const resolved = await params
    const journeyId = validateNumber(resolved.id, 'Journey id', { min: 1, integer: true })
    const recordId = validateNumber(resolved.recordId, 'Record id', { min: 1, integer: true })
    const parsed = VisibilitySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: '公开状态无效' }, { status: 400 })

    await requireInteractionAccess(supabase, user, parsed.data.visibility === 'public' ? 'submit' : 'save_progress')
    await requireRateLimit(supabase, { key: 'api-journey-record-visibility', limit: 30, windowMs: 60_000 })
    if (!(await getJourneyById(supabase, journeyId, user.id))) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 })
    }
    const record = await publishJourneyRecord(supabase, journeyId, recordId, user.id, parsed.data.visibility)
    const journey = await getJourneyById(supabase, journeyId, user.id)
    if (journey) await queueJourneyRecordModeration(supabase, journey, record)
    return NextResponse.json({ record }, { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; recordId: string }> },
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const resolved = await params
    const journeyId = validateNumber(resolved.id, 'Journey id', { min: 1, integer: true })
    const recordId = validateNumber(resolved.recordId, 'Record id', { min: 1, integer: true })
    await requireInteractionAccess(supabase, user, 'save_progress')
    await requireRateLimit(supabase, { key: 'api-journey-record-delete', limit: 30, windowMs: 60_000 })

    await removeJourneyRecord(supabase, journeyId, recordId, user.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
