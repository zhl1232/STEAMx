import { NextRequest, NextResponse } from 'next/server'
import { getTutorVoiceAccess } from '@/lib/ai/tutor/voice-access'
import { isTutorVoice } from '@/lib/ai/tutor/voice-catalog'
import { parseSpeechSource, resolveSpeechSource } from '@/lib/ai/tutor/speech-source'
import { createGuardedTutorSpeechStreamer, guardedSynthesizeTutorSpeech } from '@/lib/ai/tutor/guarded-speech'
import { sanitizeTutorSpeechText, TutorSpeechError } from '@/lib/ai/tutor/speech'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { BodyReadError, readBoundedJson } from '@/lib/api/bounded-body'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
const HEADERS = { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform' }

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-tutor-speech-synthesize', limit: 20, windowMs: 60_000 })
    const input = parseSpeechSource(await readBoundedJson(request, 256 * 1024))
    const access = await getTutorVoiceAccess(supabase, user)
    if (input.voice && (!access.canChoose || !isTutorVoice(input.voice))) {
      return NextResponse.json({ error: '当前账号不能使用该音色。' }, { status: access.canChoose ? 400 : 403 })
    }
    const voice = input.voice ?? access.voice
    const text = sanitizeTutorSpeechText(await resolveSpeechSource(supabase, input, access.canChoose))
    if (!text) throw new TutorSpeechError('Empty speech text', '这条回复没有可朗读的内容。', 400)
    if (input.fallback) {
      const result = await guardedSynthesizeTutorSpeech(user.id, text, { voice, signal: request.signal })
      return new Response(result.audio, { headers: { 'Content-Type': result.contentType, 'Cache-Control': 'no-store' } })
    }
    const encoder = new TextEncoder()
    let cancelled = false
    let speech: ReturnType<typeof createGuardedTutorSpeechStreamer> | undefined
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (payload: Record<string, unknown>) => {
          if (cancelled) return
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)) }
          catch { cancelled = true; speech?.abort() }
        }
        try {
          speech = createGuardedTutorSpeechStreamer(user.id, {
            voice, signal: request.signal,
            onAudio: (pcm, sampleRate) => send({ type: 'audio', pcm, sampleRate, voice }),
            onError: error => send({ type: 'error', status: error.status, error: error.userMessage }),
          })
          speech.push(text)
          const complete = await speech.finish()
          if (complete) send({ type: 'audio_done', complete: true })
          // Failure is never marked as a complete stream or eligible for replay caching.
        } catch (error) {
          speech?.abort()
          send({ type: 'error', error: error instanceof TutorSpeechError ? error.userMessage : '朗读暂时不可用，请稍后重试。' })
        } finally {
          if (!cancelled) { cancelled = true; controller.close() }
        }
      },
      cancel() { cancelled = true; speech?.abort() },
    })
    return new Response(stream, { headers: HEADERS })
  } catch (error) {
    if (error instanceof BodyReadError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof TutorSpeechError) return NextResponse.json({ error: error.userMessage }, { status: error.status })
    return handleApiError(error)
  }
}
