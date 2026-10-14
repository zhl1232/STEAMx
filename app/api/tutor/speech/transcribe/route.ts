import { NextRequest, NextResponse } from 'next/server'

import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { TutorSpeechTranscribeMetaSchema } from '@/lib/schemas'
import { createClient } from '@/lib/supabase/server'
import {
  MAX_TUTOR_SPEECH_PCM_BYTES,
  TutorSpeechError,
} from '@/lib/ai/tutor/speech'
import { logger } from '@/lib/logger'
import { BodyReadError, readBoundedForm } from '@/lib/api/bounded-body'
import { guardedTranscribeTutorSpeechPcm16 } from '@/lib/ai/tutor/guarded-speech'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const startedAt = Date.now()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, {
      key: 'api-tutor-speech-transcribe',
      limit: 10,
      windowMs: 60_000,
    })

    const formData = await readBoundedForm(request, MAX_TUTOR_SPEECH_PCM_BYTES + 16_384)
    const audio = formData.get('audio')
    const parsedMeta = TutorSpeechTranscribeMetaSchema.safeParse({
      durationMs: formData.get('durationMs'),
    })

    if (!parsedMeta.success) {
      return NextResponse.json(
        { error: parsedMeta.error.issues.map((issue) => issue.message).join(', ') },
        { status: 400 },
      )
    }
    if (!audio || !(audio instanceof File)) {
      return NextResponse.json({ error: '请选择要识别的语音' }, { status: 400 })
    }
    if (audio.size <= 0) {
      return NextResponse.json({ error: '没有录到声音，请再试一次。' }, { status: 400 })
    }
    if (audio.size > MAX_TUTOR_SPEECH_PCM_BYTES) {
      return NextResponse.json({ error: '这段语音太长了，请控制在 30 秒以内。' }, { status: 400 })
    }

    const transcript = await guardedTranscribeTutorSpeechPcm16(user.id, await audio.arrayBuffer(), { signal: request.signal })
    logger.info('Tutor speech transcribed', {
      userId: user.id,
      elapsedMs: Date.now() - startedAt,
      audioBytes: audio.size,
      durationMs: parsedMeta.data.durationMs,
      transcriptLength: transcript.length,
    })

    return NextResponse.json({
      transcript,
      durationMs: parsedMeta.data.durationMs,
    })
  } catch (error) {
    if (error instanceof BodyReadError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof TutorSpeechError) {
      return NextResponse.json({ error: error.userMessage }, { status: error.status })
    }
    return handleApiError(error)
  }
}
