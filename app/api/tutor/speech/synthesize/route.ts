import { NextRequest, NextResponse } from 'next/server'

import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { TutorSpeechSynthesizeSchema } from '@/lib/schemas'
import { createClient } from '@/lib/supabase/server'
import { synthesizeTutorSpeech, TutorSpeechError } from '@/lib/ai/tutor/speech'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const startedAt = Date.now()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, {
      key: 'api-tutor-speech-synthesize',
      limit: 20,
      windowMs: 60_000,
    })

    const parsed = TutorSpeechSynthesizeSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(', ') },
        { status: 400 },
      )
    }

    const result = await synthesizeTutorSpeech(parsed.data.text)
    logger.info('Tutor speech synthesized', {
      userId: user.id,
      elapsedMs: Date.now() - startedAt,
      textLength: parsed.data.text.length,
      audioBytes: result.audio.byteLength,
    })

    return new Response(result.audio, {
      headers: {
        'Content-Type': result.contentType,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (error instanceof TutorSpeechError) {
      return NextResponse.json({ error: error.userMessage }, { status: error.status })
    }
    return handleApiError(error)
  }
}
