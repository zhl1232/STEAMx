/** @vitest-environment node */

import { NextRequest, after } from 'next/server'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { DELETE, GET, POST } from '@/app/api/tutor/chat/route'
import { getAiCreditStatusForProfile } from '@/lib/api/ai-credits'
import { archiveTutorChat, beginTutorRequest, completeTutorRequest, failTutorRequest, getTutorChatSession } from '@/lib/ai/tutor/requests'
import { AuthError, requireAuth } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import {
  validateContentSafeIfPresent,
  validateOwnedOrTrustedImageUrlFromSources,
} from '@/lib/api/validation'
import { finalizeReplyAudio } from '@/lib/ai/tutor/audio-tags'
import { buildTutorSceneContext } from '@/lib/ai/tutor/context-builders'
import {
  getTutorEngineUserMessage,
  streamChatWithTutor,
  type TutorEngineMessage,
  type TutorEngineOptions,
} from '@/lib/ai/tutor/engine'
import { buildTutorGreeting } from '@/lib/ai/tutor/greeting'
import { loadTutorNotebook } from '@/lib/ai/tutor/memory'
import { planTutorResourceSearch } from '@/lib/ai/tutor/resource-search-planner'
import { formatTutorResourceSearch, searchTutorResources } from '@/lib/ai/tutor/resource-search'
import { buildTutorSystemPrompt } from '@/lib/ai/tutor/prompt'
import { findSpeciesHintsForText } from '@/lib/ai/tutor/species-hints'
import { buildStudentProfile } from '@/lib/ai/tutor/student-profile'
import { shouldPlanTutorToolDecision } from '@/lib/ai/tutor/tool-call-planner'
import { createTutorSpeechStreamer } from '@/lib/ai/tutor/speech'
import { createClient } from '@/lib/supabase/server'

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return {
    ...actual,
    after: vi.fn(),
  }
})

vi.mock('@/lib/ai/tutor/speech', () => ({ createTutorSpeechStreamer: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/auth')>()
  return {
    ...actual,
    requireAuth: vi.fn(),
  }
})

vi.mock('@/lib/api/rate-limit', () => ({
  requireRateLimit: vi.fn(),
}))

vi.mock('@/lib/api/ai-credits', () => ({
  getAiCreditStatusForProfile: vi.fn(),
}))

vi.mock('@/lib/ai/tutor/requests', () => ({ archiveTutorChat: vi.fn(), beginTutorRequest: vi.fn(), completeTutorRequest: vi.fn(), failTutorRequest: vi.fn(), getTutorChatSession: vi.fn() }))

vi.mock('@/lib/api/validation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/validation')>()
  return {
    ...actual,
    validateContentSafeIfPresent: vi.fn(),
    validateOwnedOrTrustedImageUrlFromSources: vi.fn(),
  }
})

vi.mock('@/lib/ai/tutor/audio-tags', () => ({
  finalizeReplyAudio: vi.fn((reply: string) => reply),
  findSpeciesAudiosForMessage: vi.fn().mockResolvedValue([]),
  findSpeciesAudiosMentionedInText: vi.fn().mockResolvedValue([]),
  planTutorAudioAttachment: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/ai/tutor/resource-search-planner', () => ({
  planTutorResourceSearch: vi.fn().mockResolvedValue({
    status: 'model',
    shouldSearch: false,
    queries: [],
    resourceTypes: ['course', 'project'],
  }),
}))

vi.mock('@/lib/ai/tutor/resource-search', () => ({
  formatTutorResourceSearch: vi.fn(() => ''),
  searchTutorResources: vi.fn(),
}))

vi.mock('@/lib/ai/tutor/context-builders', () => ({
  buildTutorSceneContext: vi.fn(),
}))

vi.mock('@/lib/ai/tutor/engine', () => ({
  getTutorEngineUserMessage: vi.fn(() => '小迪暂时不可用，请稍后再试。'),
  streamChatWithTutor: vi.fn(),
}))

vi.mock('@/lib/ai/tutor/greeting', () => ({
  buildTutorGreeting: vi.fn(),
}))

vi.mock('@/lib/ai/tutor/memory', () => ({
  loadTutorNotebook: vi.fn(),
  maybeUpdateTutorNotebook: vi.fn(),
  maybeUpdateTutorConversationSummary: vi.fn(),
}))

vi.mock('@/lib/ai/tutor/prompt', () => ({
  buildTutorSystemPrompt: vi.fn(() => 'system prompt'),
  TUTOR_PROMPT_VERSION: '20260812.1',
}))

vi.mock('@/lib/ai/tutor/species-hints', () => ({
  buildSpeciesHintsSummary: vi.fn(() => ''),
  findSpeciesHintsForText: vi.fn().mockResolvedValue([]),
  speciesHintsToAudioRefs: vi.fn(() => []),
}))

vi.mock('@/lib/ai/tutor/student-profile', () => ({
  buildStudentProfile: vi.fn(),
}))

vi.mock('@/lib/ai/tutor/tool-call-planner', () => ({
  planTutorToolDecision: vi.fn(),
  shouldPlanTutorToolDecision: vi.fn(() => false),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

const USER_ID = '11111111-1111-1111-1111-111111111111'
const REQUEST_ID = '33333333-3333-4333-8333-333333333333'
let billingOverride: Record<string, unknown> | null = null
const CONVERSATION_ID = '22222222-2222-2222-2222-222222222222'
const PROFILE = {
  membership_tier: null,
  membership_period: null,
  membership_started_at: null,
  membership_expires_at: null,
}
const QUOTA = {
  isMember: false,
  walletBalance: 0,
  monthlyGrant: 1500,
  freeDaily: 5,
  freeUsedToday: 1,
  freeRemainingToday: 4,
  grantPeriod: '',
  dayResetAt: 1_800_000_000,
  canChat: true,
}
const STUDENT_PROFILE = {
  displayName: '小明',
  ageGroup: '10-12 岁',
  level: 3,
  xp: 500,
  memberDays: 10,
  radarSummary: '科学60、技术50、工程40、艺术70、数学65',
  statsSummary: '完成项目2个',
  recentActivity: '完成《太阳能小车》',
  text: '昵称：小明',
}
const SCENE = {
  contextType: 'global' as const,
  contextId: '',
  title: '首页',
  summary: '学生正在首页。',
  sceneCapabilities: [],
  suggestedImages: [],
}
const CONVERSATION = {
  id: CONVERSATION_ID,
  user_id: USER_ID,
  context_type: 'global',
  context_id: '',
  title: '首页',
  status: 'active',
  meta: {},
  created_at: '2026-07-10T00:00:00.000Z',
  updated_at: '2026-07-10T00:00:00.000Z',
  archived_at: null,
}

type SupabaseOptions = {
  user?: { id: string } | null
  profile?: typeof PROFILE | null
  conversation?: typeof CONVERSATION | null
  recentMessages?: Array<Record<string, unknown>>
  insertError?: Error | null
  updateConversationError?: Error | null
}

function createTutorSupabaseMock(options: SupabaseOptions = {}) {
  const user = options.user === undefined ? { id: USER_ID } : options.user
  const profile = options.profile === undefined ? PROFILE : options.profile
  const conversation = options.conversation === undefined ? CONVERSATION : options.conversation

  vi.mocked(getTutorChatSession).mockResolvedValue({ epoch: 0, conversation: conversation as never })
  vi.mocked(completeTutorRequest).mockImplementation(async (_userId, _requestId, input) => {
    if (options.insertError) throw options.insertError
    const billing = billingOverride ?? { source: 'free', chargedCredits: 0, outputTokens: input.clarification ? null : input.outputTokens,
      usageMissing: input.outputTokens == null && !input.clarification, receiptId: 41 }
    return { status: 'completed', conversationId: CONVERSATION_ID,
      message: { role: 'assistant', content: input.reply, meta: { ...input.assistantMeta, billing } } as never }
  })
  const profileMaybeSingle = vi.fn().mockResolvedValue({ data: profile, error: null })
  const profileEq = vi.fn(() => ({ maybeSingle: profileMaybeSingle }))
  const profileSelect = vi.fn(() => ({ eq: profileEq }))

  const conversationMaybeSingle = vi.fn().mockResolvedValue({ data: conversation, error: null })
  const conversationLimit = vi.fn(() => ({ maybeSingle: conversationMaybeSingle }))
  const conversationOrder = vi.fn(() => ({ limit: conversationLimit }))
  const fourthConversationEq = vi.fn(() => ({ order: conversationOrder }))
  const thirdConversationEq = vi.fn(() => ({ eq: fourthConversationEq }))
  const secondConversationEq = vi.fn(() => ({ eq: thirdConversationEq }))
  const firstConversationEq = vi.fn(() => ({ eq: secondConversationEq }))
  const conversationSelect = vi.fn(() => ({ eq: firstConversationEq }))

  const recentMessagesResult = {
    data: options.recentMessages ?? [],
    error: null,
  }
  const messageLimit = vi.fn().mockResolvedValue(recentMessagesResult)
  const messageOrder = vi.fn(() => ({ limit: messageLimit }))
  const messageEq = vi.fn(() => ({ order: messageOrder }))
  const messageSelect = vi.fn(() => ({ eq: messageEq }))
  const messageInsert = vi.fn().mockResolvedValue({
    data: null,
    error: options.insertError ?? null,
  })

  const updateUserEq = vi.fn().mockResolvedValue({
    data: null,
    error: options.updateConversationError ?? null,
  })
  const updateIdEq = vi.fn(() => ({ eq: updateUserEq }))
  const conversationUpdate = vi.fn(() => ({ eq: updateIdEq }))

  const from = vi.fn((table: string) => {
    if (table === 'profiles') return { select: profileSelect }
    if (table === 'tutor_conversations') {
      return {
        select: conversationSelect,
        update: conversationUpdate,
      }
    }
    if (table === 'tutor_messages') {
      return {
        select: messageSelect,
        insert: messageInsert,
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  })

  return {
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user },
          error: null,
        }),
      },
      from,
    },
    messageInsert,
    conversationUpdate,
  }
}

function createPostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/tutor/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ requestId: REQUEST_ID, epoch: 0, ...(body as object) }),
  })
}

async function readSseEvents(response: Response) {
  expect(response.headers.get('content-type')).toContain('text/event-stream')
  expect(response.body).not.toBeNull()

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  const events: Array<Record<string, unknown>> = []
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''

    for (const frame of frames) {
      const line = frame.trim()
      if (!line.startsWith('data:')) continue
      events.push(JSON.parse(line.slice(5).trim()) as Record<string, unknown>)
    }
  }

  return events
}

describe('/api/tutor/chat route', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireAuthMock = requireAuth as Mock<typeof requireAuth>
  const requireRateLimitMock = requireRateLimit as Mock<typeof requireRateLimit>
  const getAiCreditStatusMock = getAiCreditStatusForProfile as Mock<typeof getAiCreditStatusForProfile>
  const beginMock = vi.mocked(beginTutorRequest)
  const completeMock = vi.mocked(completeTutorRequest)
  const failMock = vi.mocked(failTutorRequest)
  const buildStudentProfileMock = buildStudentProfile as Mock<typeof buildStudentProfile>
  const buildTutorSceneContextMock = buildTutorSceneContext as Mock<typeof buildTutorSceneContext>
  const loadTutorNotebookMock = loadTutorNotebook as Mock<typeof loadTutorNotebook>
  const buildTutorGreetingMock = buildTutorGreeting as Mock<typeof buildTutorGreeting>
  const buildTutorSystemPromptMock = buildTutorSystemPrompt as Mock<typeof buildTutorSystemPrompt>
  const streamChatWithTutorMock = streamChatWithTutor as Mock<typeof streamChatWithTutor>
  const getTutorEngineUserMessageMock = getTutorEngineUserMessage as Mock<typeof getTutorEngineUserMessage>
  const finalizeReplyAudioMock = finalizeReplyAudio as Mock<typeof finalizeReplyAudio>
  const validateContentMock = validateContentSafeIfPresent as Mock<typeof validateContentSafeIfPresent>
  const validateImageMock = validateOwnedOrTrustedImageUrlFromSources as Mock<typeof validateOwnedOrTrustedImageUrlFromSources>
  const findSpeciesHintsMock = findSpeciesHintsForText as Mock<typeof findSpeciesHintsForText>
  const shouldPlanToolMock = shouldPlanTutorToolDecision as Mock<typeof shouldPlanTutorToolDecision>
  const afterMock = after as Mock<typeof after>

  beforeEach(() => {
    vi.clearAllMocks()
    requireAuthMock.mockResolvedValue({ id: USER_ID } as never)
    requireRateLimitMock.mockResolvedValue(undefined)
    getAiCreditStatusMock.mockResolvedValue(QUOTA)
    billingOverride = null
    beginMock.mockReset().mockResolvedValue({ status: 'started', conversation: CONVERSATION as never, receiptId: 41, maxOutputTokens: 8192 })
    completeMock.mockReset()
    failMock.mockReset().mockResolvedValue({ status: 'failed' })
    vi.mocked(archiveTutorChat).mockResolvedValue({ epoch: 1 })
    buildStudentProfileMock.mockResolvedValue(STUDENT_PROFILE)
    buildTutorSceneContextMock.mockResolvedValue(SCENE)
    loadTutorNotebookMock.mockResolvedValue(null)
    buildTutorGreetingMock.mockReturnValue({
      message: '你好，我是小迪。',
      quickPrompts: ['今天学什么？'],
    })
    buildTutorSystemPromptMock.mockReturnValue('system prompt')
    finalizeReplyAudioMock.mockImplementation((reply) => reply)
    validateContentMock.mockReturnValue(undefined)
    validateImageMock.mockReturnValue(undefined)
    findSpeciesHintsMock.mockResolvedValue([])
    shouldPlanToolMock.mockReturnValue(false)
    getTutorEngineUserMessageMock.mockReturnValue('小迪暂时不可用，请稍后再试。')
    streamChatWithTutorMock.mockImplementation(async function* (_prompt, _history, options) {
      options?.onTelemetry?.({model: 'qwen-flash', usage: {promptTokens: 2000, completionTokens: 100, totalTokens: 2100}, visionFallback: false})
      yield '你好'
      yield '，一起探索吧！'
      return '你好，一起探索吧！'
    })
  })

  it('returns an empty anonymous payload without loading quota or profile data', async () => {
    const { client } = createTutorSupabaseMock({ user: null })
    createClientMock.mockResolvedValue(client as never)

    const response = await GET(new NextRequest('http://localhost/api/tutor/chat'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      messages: [],
      quota: null,
      greeting: null,
    })
    expect(getAiCreditStatusMock).not.toHaveBeenCalled()
    expect(buildStudentProfileMock).not.toHaveBeenCalled()
  })

  it.each(['processing', 'busy', 'conflict', 'stale_topic', 'failed', 'unavailable'] as const)('does not generate or mutate a terminal/duplicate admission: %s', async (status) => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    beginMock.mockResolvedValue({ status })
    const response = await POST(createPostRequest({ content: '问题' }))
    expect(response.status).toBe(409)
    expect((await response.json()).requestState).toBe(status)
    expect(streamChatWithTutorMock).not.toHaveBeenCalled()
    expect(completeMock).not.toHaveBeenCalled()
    expect(failMock).not.toHaveBeenCalled()
  })

  it('replays the exact saved answer and billing without tools, generation or a second completion', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    const billing = { source: 'wallet', chargedCredits: .1, outputTokens: 100, usageMissing: false, receiptId: 41 }
    beginMock.mockResolvedValue({ status: 'completed', conversationId: CONVERSATION_ID,
      message: { role: 'assistant', content: '原回复', meta: { billing } } as never })
    const events = await readSseEvents(await POST(createPostRequest({ content: '问题', speak: true })))
    expect(events).toEqual([{ type: 'done', reply: '原回复', billing, replayed: true }])
    expect(streamChatWithTutorMock).not.toHaveBeenCalled()
    expect(completeMock).not.toHaveBeenCalled()
    expect(createTutorSpeechStreamer).not.toHaveBeenCalled()
  })

  it('does not refund an unconfirmed admission or label it a confirmed failure', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    beginMock.mockRejectedValue(new Error('admission response lost'))
    const response = await POST(createPostRequest({ content: '问题' }))
    expect(response.status).toBe(500)
    expect((await response.json()).requestState).toBe('processing')
    expect(failMock).not.toHaveBeenCalled()
    expect(streamChatWithTutorMock).not.toHaveBeenCalled()
  })

  it('archives a topic using its epoch even before the first message has been persisted', async () => {
    const { client } = createTutorSupabaseMock({ recentMessages: [] })
    createClientMock.mockResolvedValue(client as never)
    const response = await DELETE(new NextRequest('http://localhost/api/tutor/chat?contextType=global&epoch=0', { method: 'DELETE' }))
    expect(response.status).toBe(200)
    expect(archiveTutorChat).toHaveBeenCalledWith(USER_ID, 'global', '', 0)
  })

  it('requires a stable request ID and a loaded topic epoch', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    const response = await POST(createPostRequest({ content: '问题', requestId: undefined, epoch: undefined }))
    expect(response.status).toBe(400)
    expect(beginMock).not.toHaveBeenCalled()
  })

  it('hides stored reasoning in active history while preserving user text', async () => {
    const { client } = createTutorSupabaseMock({ recentMessages: [
      { role: 'assistant', content: '内部分析</think>可以观察气泡。', meta: {} },
      { role: 'user', content: '标签 <think> 是什么？', meta: {} },
    ] })
    createClientMock.mockResolvedValue(client as never)

    const response = await GET(new NextRequest('http://localhost/api/tutor/chat'))
    const payload = await response.json()

    expect(payload.messages.map((message: { content: string }) => message.content)).toEqual([
      '标签 <think> 是什么？', '可以观察气泡。',
    ])
  })

  it('removes stored assistant reasoning before the next model turn', async () => {
    const { client } = createTutorSupabaseMock({ recentMessages: [
      { role: 'assistant', content: '<think>内部分析</think>可以观察气泡。', meta: {} },
    ] })
    createClientMock.mockResolvedValue(client as never)

    await readSseEvents(await POST(createPostRequest({ contextType: 'global', content: '还需要什么材料？' })))

    const messages = streamChatWithTutorMock.mock.calls[0][1]
    expect(messages[0].content).toBe('可以观察气泡。')
    expect(JSON.stringify(messages)).not.toContain('内部分析')
  })

  it('searches material projects before generating the recommendation', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    vi.mocked(planTutorResourceSearch).mockResolvedValueOnce({
      status: 'model', shouldSearch: true, queries: ['小苏打'], resourceTypes: ['project'],
    })
    const result = { status: 'complete' as const, queries: ['小苏打'], broadenedQueries: [], courses: [],
      projects: [{ id: 23, title: '气泡实验', description: null, tags: null }],
    }
    vi.mocked(searchTutorResources).mockResolvedValueOnce(result)
    vi.mocked(formatTutorResourceSearch).mockReturnValueOnce('[project:23|气泡实验]')

    await readSseEvents(await POST(createPostRequest({ contextType: 'global', content: '我有小苏打可以做什么实验' })))

    expect(searchTutorResources).toHaveBeenCalledWith(client, expect.objectContaining({ queries: ['小苏打'] }))
    expect(buildTutorSystemPromptMock.mock.calls[0][0].resourceSummary).toContain('[project:23|气泡实验]')
    expect(searchTutorResources).toHaveBeenCalledBefore(streamChatWithTutorMock)
  })

  it('tells the reply model that failed planning did not search the catalog', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    vi.mocked(planTutorResourceSearch).mockResolvedValueOnce({
      status: 'fallback', shouldSearch: false, queries: [], resourceTypes: ['course', 'project'],
    })

    await readSseEvents(await POST(createPostRequest({ contextType: 'global', content: '我有小苏打可以做什么实验' })))

    expect(searchTutorResources).not.toHaveBeenCalled()
    expect(buildTutorSystemPromptMock.mock.calls[0][0].resourceSummary).toContain('未完成站内检索')
    expect(buildTutorSystemPromptMock.mock.calls[0][0].resourceSummary).toContain('不得声称没有匹配项目')
  })

  it('validates all resource references before streaming, speech, and persistence', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    vi.mocked(planTutorResourceSearch).mockResolvedValueOnce({
      status: 'model', shouldSearch: true, queries: ['缓冲'], resourceTypes: ['resource'],
    })
    vi.mocked(searchTutorResources).mockResolvedValueOnce({
      status: 'complete', queries: ['缓冲'], broadenedQueries: [], courses: [], projects: [],
      resources: [{ id: 1, title: '缓冲原理', summary: '', category: 'principle' }, { id: 2, title: '材料对比', summary: '', category: 'material' }],
    })
    vi.mocked(formatTutorResourceSearch).mockReturnValueOnce('检索结果\n[resource:1|缓冲原理]\n[resource:2|材料对比]')
    const speech = { start: vi.fn(), push: vi.fn(), finish: vi.fn().mockResolvedValue(true), abort: vi.fn() }
    vi.mocked(createTutorSpeechStreamer).mockReturnValue(speech)
    const raw = '[resource:1|改写标题] [resource:2|模型标题] [resource:99|未知资料]'
    const safe = '[resource:1|缓冲原理] [resource:2|材料对比] 未知资料'
    streamChatWithTutorMock.mockImplementation(async function* () { yield raw; return raw })

    const events = await readSseEvents(await POST(createPostRequest({ content: '找缓冲资料', speak: true })))

    expect(events).toContainEqual({ type: 'chunk', content: safe })
    expect(events).toContainEqual(expect.objectContaining({ type: 'done', reply: safe }))
    expect(speech.push).toHaveBeenCalledWith(safe)
    expect(completeMock).toHaveBeenCalledWith(USER_ID, REQUEST_ID, expect.objectContaining({ reply: safe }))
  })

  it('waits for safe model text before starting speech', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    const speech = { start: vi.fn(), push: vi.fn(), finish: vi.fn().mockResolvedValue(true), abort: vi.fn() }
    vi.mocked(createTutorSpeechStreamer).mockReturnValue(speech)
    streamChatWithTutorMock.mockImplementation(async function* () {
      expect(speech.start).not.toHaveBeenCalled()
      expect(speech.push).not.toHaveBeenCalled()
      yield '可以观察气泡。'
      return '可以观察气泡。'
    })

    await readSseEvents(await POST(createPostRequest({ contextType: 'global', content: '实验怎么做？', speak: true })))

    expect(speech.push).toHaveBeenCalledWith('可以观察气泡。')
    expect(speech.finish).toHaveBeenCalledOnce()
  })

  it('returns only quota for quotaOnly requests and skips expensive tutor context', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)

    const response = await GET(new NextRequest('http://localhost/api/tutor/chat?quotaOnly=1'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ quota: QUOTA })
    expect(getAiCreditStatusMock).toHaveBeenCalledOnce()
    expect(buildStudentProfileMock).not.toHaveBeenCalled()
    expect(buildTutorSceneContextMock).not.toHaveBeenCalled()
    expect(loadTutorNotebookMock).not.toHaveBeenCalled()
  })

  it('rejects unauthenticated chat requests before rate limiting or charging', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    requireAuthMock.mockRejectedValue(new AuthError('Unauthorized'))

    const response = await POST(createPostRequest({ content: '你好，小迪' }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: 'Unauthorized' })
    expect(requireRateLimitMock).not.toHaveBeenCalled()
    expect(beginMock).not.toHaveBeenCalled()
  })

  it('rejects empty messages without charging quota', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)

    const response = await POST(createPostRequest({ content: '   ', images: [] }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: '消息不能为空' })
    expect(beginMock).not.toHaveBeenCalled()
  })

  it('returns quota details without opening a stream when credits are exhausted', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    beginMock.mockResolvedValue({
      status: 'rejected',
      error: 'quota_exceeded',
      resetAt: 1_800_000_000,
    })

    const response = await POST(createPostRequest({ content: '给我一个提示' }))

    expect(response.status).toBe(402)
    await expect(response.json()).resolves.toMatchObject({
      error: '今日免费次数或本月代币已用完。',
      code: 'quota_exceeded',
      resetAt: 1_800_000_000,
    })
    expect(streamChatWithTutorMock).not.toHaveBeenCalled()
  })

  it('streams chunks, emits done, and persists both sides of the conversation', async () => {
    const { client } = createTutorSupabaseMock({
      recentMessages: [
        {
          role: 'assistant',
          content: '上次我们在研究太阳能小车。',
          images: null,
        },
      ],
    })
    createClientMock.mockResolvedValue(client as never)

    const response = await POST(createPostRequest({
      contextType: 'global',
      content: '下一步做什么？',
      surface: 'profile',
    }))
    const events = await readSseEvents(response)

    expect(response.headers.get('cache-control')).toBe('no-cache, no-transform')
    expect(events).toEqual([
      { type: 'chunk', content: '你好' },
      { type: 'chunk', content: '，一起探索吧！' },
      expect.objectContaining({ type: 'done', reply: '你好，一起探索吧！' }),
    ])
    expect(beginMock).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ requestId: REQUEST_ID, epoch: 0 }))
    expect(streamChatWithTutorMock).toHaveBeenCalledWith(
      'system prompt',
      [
        {
          role: 'assistant',
          content: '上次我们在研究太阳能小车。',
          images: undefined,
        },
        {
          role: 'user',
          content: '下一步做什么？',
          images: undefined,
        },
      ],
      expect.objectContaining({
        onVisionFallback: expect.any(Function),
        onTelemetry: expect.any(Function),
      }),
    )
    expect(completeMock).toHaveBeenCalledWith(USER_ID, REQUEST_ID, expect.objectContaining({ content: '下一步做什么？', reply: '你好，一起探索吧！' }))
    expect(afterMock).toHaveBeenCalledOnce()
    expect(completeMock).toHaveBeenCalledWith(USER_ID, REQUEST_ID, expect.objectContaining({ outputTokens: 100 }))
  })

  it('emits a friendly SSE error and refunds credits exactly once when the model stream fails', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    streamChatWithTutorMock.mockImplementation(async function* (): AsyncGenerator<string, string, undefined> {
      throw new Error('upstream unavailable')
    })

    const response = await POST(createPostRequest({ content: '帮我看看' }))
    const events = await readSseEvents(response)

    expect(events).toEqual([
      { type: 'error', error: '小迪暂时不可用，请稍后再试。', requestState: 'failed' },
    ])
    expect(getTutorEngineUserMessageMock).toHaveBeenCalledWith(expect.any(Error))
    expect(failMock).toHaveBeenCalledTimes(1)
    expect(failMock).toHaveBeenCalledWith(USER_ID, REQUEST_ID)
    expect(completeMock).not.toHaveBeenCalled()
  })

  it('refunds credits when context building fails after charging', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    buildTutorSceneContextMock.mockRejectedValue(new Error('scene backend down'))

    const response = await POST(createPostRequest({ content: '帮我看看' }))

    expect(response.status).toBe(500)
    expect(beginMock).toHaveBeenCalledOnce()
    expect(failMock).toHaveBeenCalledTimes(1)
    expect(failMock).toHaveBeenCalledWith(USER_ID, REQUEST_ID)
    expect(streamChatWithTutorMock).not.toHaveBeenCalled()
  })

  it('bills only answer tokens without a vision surcharge when images fall back to text', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    beginMock.mockResolvedValue({
      status: 'started', conversation: CONVERSATION as never,
      receiptId: 41,
      maxOutputTokens: 8192,
    })
    streamChatWithTutorMock.mockImplementation(async function* (
      _systemPrompt: string,
      _history: TutorEngineMessage[],
      options?: TutorEngineOptions,
    ): AsyncGenerator<string, string, undefined> {
      options?.onVisionFallback?.()
      yield '我先按文字帮你分析。'
      options?.onTelemetry?.({
        model: 'qwen-flash',
        usage: { promptTokens: 221, completionTokens: 100, totalTokens: 321 },
        visionFallback: true,
      })
      return '我先按文字帮你分析。'
    })

    const response = await POST(createPostRequest({
      content: '看看这张图',
      images: ['https://example.com/pic.png'],
    }))
    const events = await readSseEvents(response)

    // 图片不另外收费，仅结算实际回答用量。
    expect(beginMock).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ requestId: REQUEST_ID, epoch: 0 }))
    expect(completeMock).toHaveBeenCalledTimes(1)
    expect(completeMock).toHaveBeenCalledWith(USER_ID, REQUEST_ID, expect.objectContaining({ outputTokens: 100 }))
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'warning', warning: expect.stringContaining('图片') }),
    )
    expect(events).toContainEqual(expect.objectContaining({ type: 'done', reply: '我先按文字帮你分析。' }))
    // 模型、token 用量与 prompt 版本落在助手消息 meta 里
    const saved = completeMock.mock.calls[0][2]
    expect(saved.assistantMeta).toMatchObject({
      ai: {
        promptVersion: expect.stringMatching(/^\d{8}\.\d+$/),
        model: 'qwen-flash',
        visionFallback: true,
        usage: { promptTokens: 221, completionTokens: 100, totalTokens: 321 },
      },
    })
    expect(saved.meta).not.toHaveProperty('ai')
  })

  it('does not create a conversation on GET when none is active', async () => {
    const { client } = createTutorSupabaseMock({ conversation: null })
    createClientMock.mockResolvedValue(client as never)

    const response = await GET(new NextRequest('http://localhost/api/tutor/chat'))

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.conversation).toBeNull()
    expect(payload.messages).toEqual([])
    expect(payload.greeting).toEqual({
      message: '你好，我是小迪。',
      quickPrompts: ['今天学什么？'],
    })
  })

  it('does not release an uncertain commit after image fallback', async () => {
    const { client } = createTutorSupabaseMock({ insertError: new Error('database unavailable') })
    createClientMock.mockResolvedValue(client as never)
    beginMock.mockResolvedValue({ status: 'started', conversation: CONVERSATION as never, maxOutputTokens: 8192, receiptId: 42 })
    streamChatWithTutorMock.mockImplementation(async function* (_prompt, _history, options) {
      options?.onVisionFallback?.()
      yield '这次先按文字说明。'
      return '这次先按文字说明。'
    })
    const response = await POST(createPostRequest({ content: '看看图片', images: ['https://example.com/pic.png'] }))
    await readSseEvents(response)
    expect(failMock).not.toHaveBeenCalled()
  })

  it('keeps uncertain persistence pending without pretending it failed or refunding a possibly committed reply', async () => {
    const { client, conversationUpdate } = createTutorSupabaseMock({
      insertError: new Error('database unavailable'),
    })
    createClientMock.mockResolvedValue(client as never)

    const response = await POST(createPostRequest({ content: '继续讲讲' }))
    const events = await readSseEvents(response)

    expect(events).toEqual([
      { type: 'chunk', content: '你好' },
      { type: 'chunk', content: '，一起探索吧！' },
      expect.objectContaining({ type: 'error', requestState: 'processing' }),
    ])
    expect(failMock).not.toHaveBeenCalled()
    expect(conversationUpdate).not.toHaveBeenCalled()
    expect(afterMock).not.toHaveBeenCalled()
  })
  it.each([100, 2500])('settles %i answer tokens, excluding prompt and reasoning tokens', async (tokens) => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    beginMock.mockResolvedValue({ status: 'started', conversation: CONVERSATION as never, receiptId: 41, maxOutputTokens: 8192 })
    const billing = { source: 'wallet' as const, chargedCredits: tokens / 1000, outputTokens: tokens, usageMissing: false, receiptId: 41 }
    billingOverride = billing
    streamChatWithTutorMock.mockImplementation(async function* (_prompt, _history, options) {
      options?.onTelemetry?.({ model: 'qwen-flash', usage: { promptTokens: 15000, completionTokens: tokens + 500, reasoningTokens: 500 }, visionFallback: false })
      yield '这是回答'
      return '这是回答'
    })
    const events = await readSseEvents(await POST(createPostRequest({ content: '请解释', outputTokens: 999999 })))
    expect(completeMock).toHaveBeenCalledWith(USER_ID, REQUEST_ID, expect.objectContaining({ outputTokens: tokens }))
    expect(events).toContainEqual({ type: 'done', reply: '这是回答', billing })
    expect(completeMock.mock.calls[0][2].assistantMeta.ai).toMatchObject({ creditReceiptId: 41 })
  })

  it('does not charge guessed tokens when provider usage is missing', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    beginMock.mockResolvedValue({ status: 'started', conversation: CONVERSATION as never, receiptId: 41, maxOutputTokens: 8192 })
    billingOverride = { source: 'wallet', chargedCredits: 0, outputTokens: null, usageMissing: true, receiptId: 41 }
    streamChatWithTutorMock.mockImplementation(async function* () { yield '回答'; return '回答' })
    const events = await readSseEvents(await POST(createPostRequest({ content: '问一下' })))
    expect(completeMock).toHaveBeenCalledWith(USER_ID, REQUEST_ID, expect.objectContaining({ outputTokens: null }))
    expect(events).toContainEqual(expect.objectContaining({ type: 'warning', warning: expect.stringContaining('不收取代币') }))
  })

  it('passes the reserved low wallet budget to the model', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    beginMock.mockResolvedValue({ status: 'started', conversation: CONVERSATION as never, receiptId: 41, maxOutputTokens: 125 })
    await readSseEvents(await POST(createPostRequest({ content: '问一下' })))
    expect(streamChatWithTutorMock).toHaveBeenCalledWith(expect.any(String), expect.any(Array), expect.objectContaining({ maxTokens: 125 }))
    expect(completeMock).toHaveBeenCalledOnce()
  })

  it('releases the reservation for a clarification without charging internal planner usage', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    vi.mocked(planTutorResourceSearch).mockResolvedValueOnce({
      status: 'model', shouldSearch: false, queries: [], resourceTypes: ['project'],
      clarification: { prompt: '想做什么实验？', options: [{ id: 'science', label: '科学实验', value: '科学实验' }, { id: 'build', label: '搭建', value: '搭建' }] },
    } as never)
    await readSseEvents(await POST(createPostRequest({ content: '推荐一个' })))
    expect(completeMock).toHaveBeenCalledWith(USER_ID, REQUEST_ID, expect.objectContaining({ clarification: true, outputTokens: null }))
    expect(streamChatWithTutorMock).not.toHaveBeenCalled()
  })

  it('releases the hold if reply finalization fails after model output', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    finalizeReplyAudioMock.mockImplementationOnce(() => { throw new Error('post-processing failed') })
    const events = await readSseEvents(await POST(createPostRequest({ content: '请回答' })))
    expect(events).toContainEqual(expect.objectContaining({ type: 'error' }))
    expect(failMock).toHaveBeenCalledWith(USER_ID, REQUEST_ID)
    expect(completeMock).not.toHaveBeenCalled()
  })

  it('returns persisted billing with active conversation messages', async () => {
    const billing = { source: 'wallet', chargedCredits: 0.123, outputTokens: 123, usageMissing: false, receiptId: 41 }
    const { client } = createTutorSupabaseMock({ recentMessages: [{ role: 'assistant', content: '回答', meta: { billing } }] })
    createClientMock.mockResolvedValue(client as never)
    const payload = await (await GET(new NextRequest('http://localhost/api/tutor/chat'))).json()
    expect(payload.messages[0].billing).toEqual(billing)
  })

  it('waives charges for filtered reasoning without separately reported reasoning tokens', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    streamChatWithTutorMock.mockImplementation(async function* (_prompt, _history, options) {
      options?.onTelemetry?.({ model: 'qwen-flash', usage: { completionTokens: 500 }, visionFallback: false, outputSanitized: true })
      yield '可见回答'; return '可见回答'
    })
    await readSseEvents(await POST(createPostRequest({ content: '问题' })))
    expect(completeMock).toHaveBeenCalledWith(USER_ID, REQUEST_ID, expect.objectContaining({ outputTokens: null }))
  })

  it('keeps a saved and settled answer successful if subsequent bookkeeping throws', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    afterMock.mockImplementationOnce(() => { throw new Error('bookkeeping unavailable') })
    const events = await readSseEvents(await POST(createPostRequest({ content: '问题' })))
    expect(events.some(event => event.type === 'error')).toBe(false)
    expect(events).toContainEqual(expect.objectContaining({ type: 'done', reply: '你好，一起探索吧！' }))
    expect(completeMock).toHaveBeenCalledOnce()
  })

})
