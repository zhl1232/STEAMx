import { NextRequest, NextResponse } from 'next/server'

import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { TutorSpeechSynthesizeSchema } from '@/lib/schemas'
import { createClient } from '@/lib/supabase/server'
import {
  createTutorRealtimeTtsSession,
  sanitizeTutorSpeechText,
  synthesizeTutorSpeech,
  TUTOR_TTS_PCM_SAMPLE_RATE,
  TutorSpeechError,
} from '@/lib/ai/tutor/speech'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
} as const

function mpegResponse(audio: ArrayBuffer, contentType: string) {
  return new Response(audio, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    },
  })
}

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

    const safeText = sanitizeTutorSpeechText(parsed.data.text)
    if (!safeText) {
      throw new TutorSpeechError('Empty speech text', '这条回复没有可朗读的内容。', 400)
    }

    if (parsed.data.fallback) {
      const result = await synthesizeTutorSpeech(parsed.data.text)
      logger.info('Tutor speech synthesized', {
        userId: user.id,
        elapsedMs: Date.now() - startedAt,
        textLength: parsed.data.text.length,
        audioBytes: result.audio.byteLength,
        fallback: true,
      })
      return mpegResponse(result.audio, result.contentType)
    }

    const encoder = new TextEncoder()
    let session: ReturnType<typeof createTutorRealtimeTtsSession> | null = null
    let cancelled = false
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (payload: Record<string, unknown>) => {
          if (cancelled) return
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
          } catch {
            cancelled = true
          }
        }
        const safeClose = () => {
          if (cancelled) return
          cancelled = true
          try {
            controller.close()
          } catch {
            // already closed
          }
        }
        try {
          session = createTutorRealtimeTtsSession({
            onAudio: (pcm) => {
              if (pcm.byteLength <= 0) return
              send({
                type: 'audio',
                pcm: pcm.toString('base64'),
                sampleRate: TUTOR_TTS_PCM_SAMPLE_RATE,
              })
            },
            signal: request.signal,
          })
          await session.ready
          session.append(safeText)
          await session.finish()
          send({ type: 'audio_done' })
          logger.info('Tutor speech realtime synthesized', {
            userId: user.id,
            elapsedMs: Date.now() - startedAt,
            textLength: parsed.data.text.length,
          })
          safeClose()
        } catch (error) {
          session?.abort()
          send({
            type: 'error',
            error: error instanceof TutorSpeechError ? error.userMessage : '小迪语音暂时不可用，请稍后再试。',
          })
          logger.warn('Tutor realtime TTS synthesize failed', {
            userId: user.id,
            message: error instanceof Error ? error.message : String(error),
          })
          safeClose()
        }
      },
      cancel() {
        cancelled = true
        session?.abort()
      },
    })

    return new Response(stream, { headers: SSE_HEADERS })
  } catch (error) {
    if (error instanceof TutorSpeechError) {
      return NextResponse.json({ error: error.userMessage }, { status: error.status })
    }
    return handleApiError(error)
  }
}
