import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  transcribe: vi.fn(),
  settings: vi.fn(),
  config: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/content-classification', () => ({
  getContentClassificationSettings: mocks.settings,
  mapPublicClassification: vi.fn(),
}))
vi.mock('@/lib/ai/dashscope', () => ({ resolveDashScopeConfig: mocks.config }))
vi.mock('@/lib/ai/tutor/guarded-speech', () => ({
  guardedTranscribeTutorSpeechPcm16: (_userId: string, audio: ArrayBuffer, options: unknown) => mocks.transcribe(audio, options),
}))
vi.mock('@/lib/ai/tutor/speech', () => ({
  transcribeTutorSpeechPcm16: mocks.transcribe,
  TutorSpeechError: class TutorSpeechError extends Error {
    constructor(message: string, public userMessage = '语音暂时不可用。', public status = 503) {
      super(message)
    }
  },
}))

import { TutorSpeechError } from '@/lib/ai/tutor/speech'
import { POST } from './route'

type Row = Record<string, unknown>

function database() {
  const rows: Record<string, Row | null> = {
    courses: { id: 5, title: '积木课', status: 'approved', classification_status: 'reviewed', is_listed: true },
    course_lessons: {
      id: 30, course_id: 5, title: '小汽车', lesson_type: 'building_3d',
      content: { building3d: { slideImageUrls: ['/courses/car.webp'] } },
    },
  }
  const queries: Array<{ table: string; filters: Array<[string, unknown]> }> = []
  const counts = new Map<string, number>()
  const from = vi.fn((table: string) => {
    const query = { table, filters: [] as Array<[string, unknown]> }
    queries.push(query)
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((key: string, value: unknown) => {
        query.filters.push([key, value])
        return builder
      }),
      maybeSingle: vi.fn(async () => {
        const row = rows[table]
        return { data: row && query.filters.every(([key, value]) => row[key] === value) ? row : null, error: null }
      }),
    }
    return builder
  })
  const rpc = vi.fn(async (name: string, args: { p_key: string; p_limit: number; p_window_seconds: number }) => {
    if (name !== 'consume_rate_limit') throw new Error(`Unexpected RPC: ${name}`)
    const count = counts.get(args.p_key) ?? 0
    const ok = count < args.p_limit
    if (ok) counts.set(args.p_key, count + 1)
    const now = Math.floor(Date.now() / 1_000)
    return {
      error: null,
      data: {
        ok, limit: args.p_limit, remaining: Math.max(0, args.p_limit - count - 1),
        reset_at: (Math.floor(now / args.p_window_seconds) + 1) * args.p_window_seconds,
      },
    }
  })
  return { rows, queries, counts, from, rpc, auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } as { id: string } | null }, error: null })) } }
}

function request(options: {
  audioBytes?: number; durationMs?: string; courseId?: string; lessonId?: string;
  audioType?: string; omitAudio?: boolean; extra?: Record<string, string>;
} = {}) {
  const form = new FormData()
  form.set('courseId', options.courseId ?? '5')
  form.set('lessonId', options.lessonId ?? '30')
  form.set('durationMs', options.durationMs ?? '1000')
  if (!options.omitAudio) {
    form.set('audio', new File([new Uint8Array(options.audioBytes ?? 32_000)], 'voice.pcm', { type: options.audioType ?? 'audio/pcm' }))
  }
  for (const [key, value] of Object.entries(options.extra ?? {})) form.set(key, value)
  return new NextRequest('https://steam.bj.cn/api/tutor/speech/course-control', { method: 'POST', body: form })
}

describe('POST /api/tutor/speech/course-control', () => {
  let db: ReturnType<typeof database>
  let info: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    db = database()
    mocks.createClient.mockResolvedValue(db)
    mocks.settings.mockResolvedValue({ publicV1Enabled: true, enforcementEnabled: true })
    mocks.config.mockReturnValue({ model: 'qwen3-asr-flash-realtime' })
    mocks.transcribe.mockResolvedValue('小迪，下一步。')
    info = vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('authenticates before reading or transcribing audio', async () => {
    db.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const response = await POST(request())
    expect(response.status).toBe(401)
    expect(db.from).not.toHaveBeenCalled()
    expect(db.rpc).not.toHaveBeenCalled()
    expect(mocks.transcribe).not.toHaveBeenCalled()
  })

  it('executes only a navigation command after both server-fixed DB admissions', async () => {
    mocks.transcribe.mockImplementation(async () => {
      expect(db.rpc).toHaveBeenCalledTimes(2)
      return '小迪，下一页'
    })
    const response = await POST(request({ extra: { limit: '999999', windowMs: '1', key: 'different' } }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ command: 'next' })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(db.rpc.mock.calls).toEqual([
      ['consume_rate_limit', { p_key: 'api-course-voice-minute-v1', p_limit: 20, p_window_seconds: 60 }],
      ['consume_rate_limit', { p_key: 'api-course-voice-day-v1', p_limit: 120, p_window_seconds: 86_400 }],
    ])
    expect(mocks.transcribe.mock.calls[0][0]).toBeInstanceOf(ArrayBuffer)
    expect(mocks.transcribe.mock.calls[0][0].byteLength).toBe(32_000)
    expect(db.queries).toEqual([
      { table: 'courses', filters: [['id', 5], ['status', 'approved'], ['classification_status', 'reviewed']] },
      { table: 'course_lessons', filters: [['course_id', 5], ['id', 30]] },
    ])
  })

  it('retains direct access to approved, unlisted historical courses', async () => {
    db.rows.courses!.is_listed = false
    expect((await POST(request())).status).toBe(200)
  })

  it.each(['pending', 'rejected'])('rejects %s courses before any supplier cost', async (status) => {
    db.rows.courses!.status = status
    expect((await POST(request())).status).toBe(404)
    expect(db.rpc).not.toHaveBeenCalled()
    expect(mocks.transcribe).not.toHaveBeenCalled()
  })

  it('enforces reviewed classification when its rollout gate is on', async () => {
    db.rows.courses!.classification_status = 'unreviewed'
    expect((await POST(request())).status).toBe(404)
    expect(mocks.transcribe).not.toHaveBeenCalled()
  })

  it('retains the existing classification rollout compatibility', async () => {
    db.rows.courses!.classification_status = 'unreviewed'
    mocks.settings.mockResolvedValue({ publicV1Enabled: false, enforcementEnabled: false })
    expect((await POST(request())).status).toBe(200)
  })

  it('requires the lesson to belong to this approved course', async () => {
    db.rows.course_lessons!.course_id = 6
    expect((await POST(request())).status).toBe(404)
    expect(mocks.transcribe).not.toHaveBeenCalled()
  })

  it.each([
    { lesson_type: 'scratch', content: { building3d: { slideImageUrls: ['/x.webp'] } } },
    { lesson_type: 'building_3d', content: {} },
  ])('requires a building lesson with actual display pages', async (row) => {
    Object.assign(db.rows.course_lessons!, row)
    expect((await POST(request())).status).toBe(400)
    expect(db.rpc).not.toHaveBeenCalled()
    expect(mocks.transcribe).not.toHaveBeenCalled()
  })

  it('uses PCM byte length for the strict 8-second input limit, not claimed duration', async () => {
    const response = await POST(request({ audioBytes: 256_002, durationMs: '1' }))
    expect(response.status).toBe(413)
    expect(mocks.transcribe).not.toHaveBeenCalled()
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('records actual 8-second PCM duration despite forged 1ms metadata', async () => {
    expect((await POST(request({ audioBytes: 256_000, durationMs: '1' }))).status).toBe(200)
    expect(JSON.parse(info.mock.calls[0][0])).toEqual({
      event: 'course_voice_recognition', userId: 'user-1', courseId: 5, lessonId: 30,
      audioBytes: 256_000, durationMs: 8_000, model: 'qwen3-asr-flash-realtime',
      command: 'next', outcome: 'matched', elapsedMs: expect.any(Number),
    })
  })

  it.each([
    { omitAudio: true }, { audioBytes: 0 }, { audioBytes: 3 },
    { audioType: 'audio/wav' }, { durationMs: 'NaN' }, { durationMs: '-1' },
    { durationMs: '8001' }, { courseId: '5.5' }, { courseId: '0' }, { lessonId: '1e2' },
  ])('rejects invalid audio metadata/format before quota admission: %j', async (options) => {
    expect((await POST(request(options))).status).toBe(400)
    expect(db.rpc).not.toHaveBeenCalled()
    expect(mocks.transcribe).not.toHaveBeenCalled()
  })

  it('bounds an oversized multipart body even without Content-Length', async () => {
    // Model bytes arriving over HTTP, rather than cancelling Node's asynchronous
    // multipart encoder (which can enqueue after cancellation in Node 22).
    const encoded = request({ audioBytes: 300_000 })
    const oversized = new NextRequest(encoded.url, { method: 'POST', headers: encoded.headers, body: await encoded.arrayBuffer() })
    expect(oversized.headers.has('content-length')).toBe(false)
    expect((await POST(oversized)).status).toBe(413)
    expect(mocks.transcribe).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed multipart rather than exposing parser details', async () => {
    const malformed = new NextRequest('https://steam.bj.cn/api/tutor/speech/course-control', {
      method: 'POST', body: 'private malformed body', headers: { 'Content-Type': 'multipart/form-data; boundary=missing' },
    })
    const response = await POST(malformed)
    expect(response.status).toBe(400)
    expect(await response.text()).not.toContain('private malformed body')
    expect(mocks.transcribe).not.toHaveBeenCalled()
  })

  it('returns a short minute retry without contacting the supplier', async () => {
    db.counts.set('api-course-voice-minute-v1', 20)
    const response = await POST(request())
    const body = await response.json()
    expect(response.status).toBe(429)
    expect(body.code).toBe('course_voice_minute_limit')
    expect(body.error).toContain('秒后重新开启')
    expect(body.retryAfterSeconds).toBeGreaterThanOrEqual(1)
    expect(body.retryAfterSeconds).toBeLessThanOrEqual(60)
    expect(response.headers.get('retry-after')).toBe(String(body.retryAfterSeconds))
    expect(db.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.transcribe).not.toHaveBeenCalled()
  })

  it('returns the fixed daily bucket reset time in Shanghai and does not call ASR', async () => {
    db.counts.set('api-course-voice-day-v1', 120)
    const response = await POST(request())
    const body = await response.json()
    expect(response.status).toBe(429)
    expect(body.code).toBe('course_voice_daily_limit')
    expect(body.error).toContain('08:00')
    expect(body.error).toContain('点击按钮翻页')
    expect(new Date(body.resetAt * 1_000).getUTCHours()).toBe(0)
    expect(mocks.transcribe).not.toHaveBeenCalled()
  })

  it('fails closed if the authoritative database limiter fails', async () => {
    db.rpc.mockRejectedValue(new Error('private database details'))
    const response = await POST(request())
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('private')
    expect(mocks.transcribe).not.toHaveBeenCalled()
  })

  it('does not start a supplier request after the client has already cancelled', async () => {
    const encoded = request()
    const controller = new AbortController()
    const cancelled = new NextRequest(encoded.url, {
      method: 'POST', headers: encoded.headers, body: await encoded.arrayBuffer(), signal: controller.signal,
    })
    controller.abort()
    expect((await POST(cancelled)).status).toBe(400)
    expect(db.rpc).not.toHaveBeenCalled()
    expect(mocks.transcribe).not.toHaveBeenCalled()
  })

  it('lets only one of two overlapping requests pass the final daily slot', async () => {
    // The mock models atomic DB admission. Actual SQL/privileges are validated
    // separately; this is not a multi-connection Postgres concurrency test.
    db.counts.set('api-course-voice-day-v1', 119)
    const responses = await Promise.all([POST(request()), POST(request())])
    expect(responses.map((response) => response.status).sort()).toEqual([200, 429])
    expect(mocks.transcribe).toHaveBeenCalledTimes(1)
  })

  it('ignores unrelated speech without returning text or creating a chat/credit record', async () => {
    mocks.transcribe.mockResolvedValue('宝宝的秘密：下一步我们先去吃饭')
    const response = await POST(request())
    expect(await response.json()).toEqual({ command: null })
    expect(JSON.parse(info.mock.calls[0][0])).toMatchObject({ command: null, outcome: 'unmatched' })
    expect(JSON.stringify(info.mock.calls)).not.toContain('宝宝的秘密')
    expect(db.rpc.mock.calls.every(([name]) => name === 'consume_rate_limit')).toBe(true)
    expect(db.queries.every(({ table }) => ['courses', 'course_lessons'].includes(table))).toBe(true)
  })

  it('keeps failed recognitions in both counters and never automatically retries', async () => {
    mocks.transcribe.mockRejectedValue(new TutorSpeechError('private transcript in provider error', '小迪没有听清楚，请再说一次。', 400))
    const response = await POST(request())
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: '小迪没有听清楚，请再说一次。' })
    expect(db.counts.get('api-course-voice-minute-v1')).toBe(1)
    expect(db.counts.get('api-course-voice-day-v1')).toBe(1)
    expect(mocks.transcribe).toHaveBeenCalledTimes(1)
    expect(JSON.parse(info.mock.calls[0][0])).toMatchObject({ outcome: 'failed', audioBytes: 32_000, durationMs: 1_000 })
    expect(JSON.stringify(info.mock.calls)).not.toContain('private transcript')
  })

  it('never logs or exposes unknown supplier exceptions', async () => {
    mocks.transcribe.mockRejectedValue(new Error('SECRET child speech and provider data'))
    const response = await POST(request())
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('SECRET')
    expect(JSON.stringify(info.mock.calls)).not.toContain('SECRET')
    expect(mocks.transcribe).toHaveBeenCalledTimes(1)
  })
})
