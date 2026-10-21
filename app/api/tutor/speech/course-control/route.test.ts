import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), settings: vi.fn(), transcribe: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/content-classification', () => ({ getContentClassificationSettings: mocks.settings, mapPublicClassification: vi.fn() }))
vi.mock('@/lib/ai/tutor/guarded-speech', () => ({ guardedTranscribeTutorSpeechPcm16: mocks.transcribe }))
import { GET, POST } from './route'
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
  const rpc = vi.fn()
  return { rows, queries, from, rpc, auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } as { id: string } | null }, error: null })) } }
}

const request = (query = 'courseId=5&lessonId=30') => new NextRequest(`https://steam.bj.cn/api/tutor/speech/course-control?${query}`)
describe('local course voice eligibility', () => {
  let db: ReturnType<typeof database>
  beforeEach(() => {
    vi.clearAllMocks()
    db = database()
    mocks.createClient.mockResolvedValue(db)
    mocks.settings.mockResolvedValue({ publicV1Enabled: true, enforcementEnabled: true })
  })
  it('authenticates before reading course data', async () => {
    db.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await GET(request())).status).toBe(401)
    expect(db.from).not.toHaveBeenCalled()
  })
  it('returns a bounded no-store eligibility lease without recognition, quotas or writes', async () => {
    const response = await GET(request())
    expect(await response.json()).toEqual({ userId: 'user-1', validForMs: 300000 })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(db.queries).toEqual([
      { table: 'courses', filters: [['id', 5], ['status', 'approved'], ['classification_status', 'reviewed']] },
      { table: 'course_lessons', filters: [['course_id', 5], ['id', 30]] },
    ])
    expect(db.rpc).not.toHaveBeenCalled()
    expect(mocks.transcribe).not.toHaveBeenCalled()
  })
  it('retains direct access to approved, unlisted historical courses', async () => {
    db.rows.courses!.is_listed = false
    expect((await GET(request())).status).toBe(200)
  })

  it.each(['pending', 'rejected'])('rejects %s courses before any supplier cost', async (status) => {
    db.rows.courses!.status = status
    expect((await GET(request())).status).toBe(404)
    expect(db.rpc).not.toHaveBeenCalled()
    expect(mocks.transcribe).not.toHaveBeenCalled()
  })

  it('enforces reviewed classification when its rollout gate is on', async () => {
    db.rows.courses!.classification_status = 'unreviewed'
    expect((await GET(request())).status).toBe(404)
    expect(mocks.transcribe).not.toHaveBeenCalled()
  })

  it('retains the existing classification rollout compatibility', async () => {
    db.rows.courses!.classification_status = 'unreviewed'
    mocks.settings.mockResolvedValue({ publicV1Enabled: false, enforcementEnabled: false })
    expect((await GET(request())).status).toBe(200)
  })

  it('requires the lesson to belong to this approved course', async () => {
    db.rows.course_lessons!.course_id = 6
    expect((await GET(request())).status).toBe(404)
    expect(mocks.transcribe).not.toHaveBeenCalled()
  })

  it.each([
    { lesson_type: 'scratch', content: { building3d: { slideImageUrls: ['/x.webp'] } } },
    { lesson_type: 'building_3d', content: {} },
  ])('requires a building lesson with actual display pages', async (row) => {
    Object.assign(db.rows.course_lessons!, row)
    expect((await GET(request())).status).toBe(400)
    expect(db.rpc).not.toHaveBeenCalled()
    expect(mocks.transcribe).not.toHaveBeenCalled()
  })


  it.each(['', 'courseId=0&lessonId=30', 'courseId=5&lessonId=1.5', 'courseId=5&lessonId=9999999999999999'])('rejects malformed IDs: %s', async (query) => {
    expect((await GET(request(query))).status).toBe(400)
    expect(db.from).not.toHaveBeenCalled()
  })
  it('fails closed without leaking database errors', async () => {
    mocks.createClient.mockRejectedValue(new Error('private detail'))
    const response = await GET(request())
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('private detail')
  })
  it('retires the upload endpoint without reading or transcribing recordings', async () => {
    expect((await POST()).status).toBe(410)
    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(mocks.transcribe).not.toHaveBeenCalled()
  })
})
