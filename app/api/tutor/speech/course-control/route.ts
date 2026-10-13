import { NextRequest, NextResponse } from 'next/server'

import { AuthError, RateLimitError, requireAuth } from '@/lib/api/auth'
import { getLessonInCourse } from '@/lib/api/courses'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { resolveDashScopeConfig } from '@/lib/ai/dashscope'
import { TutorSpeechError, transcribeTutorSpeechPcm16 } from '@/lib/ai/tutor/speech'
import { buildBuildingLessonFlow } from '@/lib/courses/building-lesson-flow'
import { parseBuildingVoiceCommand, type BuildingVoiceCommand } from '@/lib/courses/building-voice-commands'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const PCM_BYTES_PER_SECOND = 16_000 * 2 // Provider always receives mono 16 kHz PCM16.
const MAX_AUDIO_BYTES = PCM_BYTES_PER_SECOND * 8
const MAX_REQUEST_BYTES = MAX_AUDIO_BYTES + 16_384
const LIMITS = [
  { key: 'api-course-voice-minute-v1', limit: 20, windowMs: 60_000, kind: 'minute' },
  // Existing DB rate buckets use UTC epoch boundaries: 00:00 UTC / 08:00 Shanghai.
  { key: 'api-course-voice-day-v1', limit: 120, windowMs: 86_400_000, kind: 'daily' },
] as const

class InvalidAudioRequest extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

/** Bound the body even when Content-Length is absent or dishonest. */
async function readAudioForm(request: NextRequest): Promise<FormData> {
  const length = Number(request.headers.get('content-length'))
  if (Number.isFinite(length) && length > MAX_REQUEST_BYTES) {
    throw new InvalidAudioRequest(413, '每条语音请控制在 8 秒以内。')
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;')) {
    throw new InvalidAudioRequest(400, '语音格式不正确，请重新录制。')
  }
  if (!request.body) throw new InvalidAudioRequest(400, '没有录到声音，请再试一次。')

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      byteLength += value.byteLength
      if (byteLength > MAX_REQUEST_BYTES) {
        await reader.cancel()
        throw new InvalidAudioRequest(413, '每条语音请控制在 8 秒以内。')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const body = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return await new Response(body, { headers: { 'content-type': request.headers.get('content-type')! } }).formData()
  } catch {
    throw new InvalidAudioRequest(400, '语音格式不正确，请重新录制。')
  }
}

function positiveInteger(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d{0,14}$/u.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function limitedResponse(error: RateLimitError, kind: 'minute' | 'daily') {
  const resetTime = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(error.resetAt * 1_000))
  const message = kind === 'daily'
    ? `本时段的语音操作次数已用完，${resetTime}后可继续使用；现在也可以点击按钮翻页。`
    : `语音操作较频繁，请在 ${Math.max(1, error.retryAfterSeconds)} 秒后重新开启；现在也可以点击按钮翻页。`
  return NextResponse.json({
    error: message,
    code: `course_voice_${kind}_limit`,
    retryAfterSeconds: error.retryAfterSeconds,
    resetAt: error.resetAt,
  }, {
    status: 429,
    headers: {
      'Retry-After': String(error.retryAfterSeconds),
      'X-RateLimit-Limit': String(error.limit),
      'X-RateLimit-Remaining': String(error.remaining),
      'X-RateLimit-Reset': String(error.resetAt),
      'Cache-Control': 'no-store',
    },
  })
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  let usage: { userId: string; courseId: number; lessonId: number; audioBytes: number; durationMs: number; model: string } | null = null
  let admitted = false
  let command: BuildingVoiceCommand | null = null
  let outcome: 'matched' | 'unmatched' | 'failed' = 'failed'

  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const form = await readAudioForm(request)
    const courseId = positiveInteger(form.get('courseId'))
    const lessonId = positiveInteger(form.get('lessonId'))
    const reportedDuration = form.get('durationMs')
    if (
      !courseId || !lessonId ||
      typeof reportedDuration !== 'string' || !/^\d{1,5}(?:\.\d{1,3})?$/u.test(reportedDuration) ||
      Number(reportedDuration) > 8_000
    ) {
      return NextResponse.json({ error: '课程或语音信息不正确，请重新开启语音操作。' }, { status: 400 })
    }

    const audio = form.get('audio')
    if (!(audio instanceof File) || audio.size <= 0) {
      return NextResponse.json({ error: '没有录到声音，请再试一次。' }, { status: 400 })
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: '每条语音请控制在 8 秒以内。' }, { status: 413 })
    }
    if (audio.size % 2 !== 0 || !['audio/pcm', 'application/octet-stream'].includes(audio.type)) {
      return NextResponse.json({ error: '语音格式不正确，请重新录制。' }, { status: 400 })
    }

    // Match the lesson page's approved/classification gates, including approved
    // historical courses that remain directly accessible while unlisted.
    const context = await getLessonInCourse(supabase, courseId, lessonId)
    if (!context) return NextResponse.json({ error: '暂时无法打开这节课。' }, { status: 404 })
    if (
      context.lesson.lesson_type !== 'building_3d' ||
      buildBuildingLessonFlow({ lessonTitle: context.lesson.title, content: context.lesson.content?.building3d }).length === 0
    ) {
      return NextResponse.json({ error: '这节课暂不支持语音翻页。' }, { status: 400 })
    }

    // Both atomic DB buckets must admit before any supplier request. These keys,
    // limits and windows are never taken from the request, and failures are not refunded.
    if (request.signal.aborted) throw new InvalidAudioRequest(400, '语音操作已取消，请重新开启。')
    for (const limit of LIMITS) {
      try {
        await requireRateLimit(supabase, limit)
      } catch (error) {
        if (error instanceof RateLimitError) return limitedResponse(error, limit.kind)
        throw error // Fail closed if the authoritative limiter is unavailable.
      }
    }

    const configuredModel = resolveDashScopeConfig('tutor-asr').model || 'qwen3-asr-flash-realtime'
    usage = {
      userId: user.id, courseId, lessonId,
      audioBytes: audio.size,
      durationMs: audio.size / PCM_BYTES_PER_SECOND * 1_000,
      model: /^[a-zA-Z0-9._-]{1,120}$/u.test(configuredModel) ? configuredModel : 'configured-asr',
    }
    const pcm = await audio.arrayBuffer()
    if (request.signal.aborted) throw new InvalidAudioRequest(400, '语音操作已取消，请重新开启。')
    admitted = true
    const transcript = await transcribeTutorSpeechPcm16(pcm, { signal: request.signal, courseControl: true })
    command = parseBuildingVoiceCommand(transcript)
    outcome = command ? 'matched' : 'unmatched'
    return NextResponse.json({ command }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: '请登录后开启语音操作。' }, { status: error.statusCode })
    }
    if (error instanceof InvalidAudioRequest) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof TutorSpeechError) {
      return NextResponse.json({ error: error.userMessage }, { status: error.status })
    }
    // Upstream messages can contain recognized speech. Do not pass the exception
    // to the shared API logger or expose it in development responses.
    return NextResponse.json({ error: '语音操作暂时不可用，请稍后再试。' }, { status: 503 })
  } finally {
    if (admitted && usage) {
      // logger.info currently drops production events. This server-only metadata
      // event is separate from chat/credit records and deliberately contains no
      // recording, transcript, provider payload, or raw error object.
      console.info(JSON.stringify({ event: 'course_voice_recognition', ...usage, command, outcome, elapsedMs: Date.now() - startedAt }))
    }
  }
}
