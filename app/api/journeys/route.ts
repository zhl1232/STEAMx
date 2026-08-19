import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateNumber } from '@/lib/api/validation'
import { ensureJourney, listUserJourneys } from '@/lib/journeys/service'
import { createClient } from '@/lib/supabase/server'

const CreateJourneySchema = z.object({
  source_type: z.enum(['project', 'challenge']),
  source_id: z.number().int().positive(),
  project_goal: z.string().max(160).nullable().optional(),
})

function parseStatus(value: string | null) {
  if (value === 'active' || value === 'completed' || value === 'abandoned' || value === 'all') return value
  return 'active' as const
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const status = parseStatus(request.nextUrl.searchParams.get('status'))
    const sourceTypeValue = request.nextUrl.searchParams.get('source_type')
    const sourceType = sourceTypeValue === 'project' || sourceTypeValue === 'challenge' ? sourceTypeValue : undefined
    const sourceIdValue = request.nextUrl.searchParams.get('source_id')
    const sourceId = sourceIdValue ? validateNumber(sourceIdValue, 'Source id', { min: 1, integer: true }) : undefined
    const journeys = await listUserJourneys(supabase, user.id, { status, sourceType, sourceId })
    return NextResponse.json({ journeys })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireInteractionAccess(supabase, user, 'save_progress')
    await requireRateLimit(supabase, { key: 'api-journeys-create', limit: 20, windowMs: 60_000 })

    const body = await request.json().catch(() => ({}))
    const parsed = CreateJourneySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(', ') },
        { status: 400 },
      )
    }

    const journey = await ensureJourney(supabase, {
      userId: user.id,
      sourceType: parsed.data.source_type,
      sourceId: validateNumber(String(parsed.data.source_id), 'Source id', { min: 1, integer: true }),
      projectGoal: parsed.data.project_goal,
    })

    // Compatibility pointer for old project detail/profile screens. It never
    // decides which attempt is authoritative; journey_id does.
    if (journey.source_type === 'project' && journey.project_id) {
      const now = new Date().toISOString()
      const { data: legacyExploration, error: legacyReadError } = await supabase
        .from('project_explorations')
        .select('id')
        .eq('user_id', user.id)
        .eq('project_id', journey.project_id)
        .maybeSingle()
      if (legacyReadError) throw legacyReadError

      const legacyPayload = {
        status: 'active',
        started_at: now,
        last_activity_at: now,
        completed_at: null,
        journey_id: journey.id,
        updated_at: now,
      }
      const legacyResponse = legacyExploration
        ? await supabase
            .from('project_explorations')
            .update(legacyPayload as never)
            .eq('id', legacyExploration.id)
        : await supabase.from('project_explorations').insert({
            ...legacyPayload,
            user_id: user.id,
            project_id: journey.project_id,
          } as never)
      if (legacyResponse.error) throw legacyResponse.error
    } else if (journey.source_type === 'challenge' && journey.challenge_id) {
      const { error } = await supabase
        .from('challenge_workspaces')
        .update({ journey_id: journey.id, updated_at: new Date().toISOString() } as never)
        .eq('challenge_id', journey.challenge_id)
        .eq('user_id', user.id)
      if (error) throw error
    }

    return NextResponse.json({ journey }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
