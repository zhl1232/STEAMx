/** @vitest-environment node */

import { NextRequest, after } from 'next/server'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { GET, POST } from '@/app/api/tutor/chat/route'
import { consumeAiCredit, getAiCreditStatusForProfile, refundAiCredit } from '@/lib/api/ai-credits'
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
import { buildTutorSystemPrompt } from '@/lib/ai/tutor/prompt'
import { findSpeciesHintsForText } from '@/lib/ai/tutor/species-hints'
import { buildStudentProfile } from '@/lib/ai/tutor/student-profile'
import { shouldPlanTutorToolDecision } from '@/lib/ai/tutor/tool-call-planner'
import { createClient } from '@/lib/supabase/server'

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return {
    ...actual,
    after: vi.fn(),
  }
})

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
  consumeAiCredit: vi.fn(),
  getAiCreditStatusForProfile: vi.fn(),
  refundAiCredit: vi.fn(),
}))

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
    body: JSON.stringify(body),
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
  const consumeAiCreditMock = consumeAiCredit as Mock<typeof consumeAiCredit>
  const refundAiCreditMock = refundAiCredit as Mock<typeof refundAiCredit>
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
    consumeAiCreditMock.mockResolvedValue({
      ok: true,
      source: 'free',
      remaining: 3,
      cost: 1,
    })
    refundAiCreditMock.mockResolvedValue({})
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
    streamChatWithTutorMock.mockImplementation(async function* () {
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
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(requireRateLimitMock).not.toHaveBeenCalled()
    expect(consumeAiCreditMock).not.toHaveBeenCalled()
  })

  it('rejects empty messages without charging quota', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)

    const response = await POST(createPostRequest({ content: '   ', images: [] }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: '消息不能为空' })
    expect(consumeAiCreditMock).not.toHaveBeenCalled()
  })

  it('returns quota details without opening a stream when credits are exhausted', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    consumeAiCreditMock.mockResolvedValue({
      ok: false,
      error: 'quota_exceeded',
      resetAt: 1_800_000_000,
    })

    const response = await POST(createPostRequest({ content: '给我一个提示' }))

    expect(response.status).toBe(402)
    await expect(response.json()).resolves.toMatchObject({
      error: '今日免费次数或本月代币已用完',
      code: 'quota_exceeded',
      resetAt: 1_800_000_000,
    })
    expect(streamChatWithTutorMock).not.toHaveBeenCalled()
  })

  it('streams chunks, emits done, and persists both sides of the conversation', async () => {
    const { client, messageInsert, conversationUpdate } = createTutorSupabaseMock({
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
      { type: 'done', reply: '你好，一起探索吧！' },
    ])
    expect(consumeAiCreditMock).toHaveBeenCalledWith(client, PROFILE, 1)
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
    expect(messageInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        conversation_id: CONVERSATION_ID,
        role: 'user',
        content: '下一步做什么？',
      }),
      expect.objectContaining({
        conversation_id: CONVERSATION_ID,
        role: 'assistant',
        content: '你好，一起探索吧！',
      }),
    ])
    expect(conversationUpdate).toHaveBeenCalledOnce()
    expect(afterMock).toHaveBeenCalledOnce()
    expect(refundAiCreditMock).not.toHaveBeenCalled()
  })

  it('emits a friendly SSE error and refunds credits exactly once when the model stream fails', async () => {
    const { client, messageInsert } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    streamChatWithTutorMock.mockImplementation(async function* (): AsyncGenerator<string, string, undefined> {
      throw new Error('upstream unavailable')
    })

    const response = await POST(createPostRequest({ content: '帮我看看' }))
    const events = await readSseEvents(response)

    expect(events).toEqual([
      { type: 'error', error: '小迪暂时不可用，请稍后再试。' },
    ])
    expect(getTutorEngineUserMessageMock).toHaveBeenCalledWith(expect.any(Error))
    expect(refundAiCreditMock).toHaveBeenCalledTimes(1)
    expect(refundAiCreditMock).toHaveBeenCalledWith(client, 1, 'free')
    expect(messageInsert).not.toHaveBeenCalled()
  })

  it('refunds credits when context building fails after charging', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    buildTutorSceneContextMock.mockRejectedValue(new Error('scene backend down'))

    const response = await POST(createPostRequest({ content: '帮我看看' }))

    expect(response.status).toBe(500)
    expect(consumeAiCreditMock).toHaveBeenCalledOnce()
    expect(refundAiCreditMock).toHaveBeenCalledTimes(1)
    expect(refundAiCreditMock).toHaveBeenCalledWith(client, 1, 'free')
    expect(streamChatWithTutorMock).not.toHaveBeenCalled()
  })

  it('warns and refunds the vision surcharge when image analysis falls back to text', async () => {
    const { client, messageInsert } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    consumeAiCreditMock.mockResolvedValue({
      ok: true,
      source: 'free',
      remaining: 2,
      cost: 2,
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
        usage: { totalTokens: 321 },
        visionFallback: true,
      })
      return '我先按文字帮你分析。'
    })

    const response = await POST(createPostRequest({
      content: '看看这张图',
      images: ['https://example.com/pic.png'],
    }))
    const events = await readSseEvents(response)

    // 图片对话计费 2，降级后只收文字价 1，差价 1 退回
    expect(consumeAiCreditMock).toHaveBeenCalledWith(client, PROFILE, 2)
    expect(refundAiCreditMock).toHaveBeenCalledTimes(1)
    expect(refundAiCreditMock).toHaveBeenCalledWith(client, 1, 'free')
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'warning', warning: expect.stringContaining('图片') }),
    )
    expect(events).toContainEqual({ type: 'done', reply: '我先按文字帮你分析。' })
    // 模型、token 用量与 prompt 版本落在助手消息 meta 里
    const insertedRows = messageInsert.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(insertedRows[1].meta).toMatchObject({
      ai: {
        promptVersion: expect.stringMatching(/^\d{8}\.\d+$/),
        model: 'qwen-flash',
        visionFallback: true,
        usage: { totalTokens: 321 },
      },
    })
    expect(insertedRows[0].meta).not.toHaveProperty('ai')
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

  it('keeps the generated reply visible but refunds credits when persistence fails', async () => {
    const { client, conversationUpdate } = createTutorSupabaseMock({
      insertError: new Error('database unavailable'),
    })
    createClientMock.mockResolvedValue(client as never)

    const response = await POST(createPostRequest({ content: '继续讲讲' }))
    const events = await readSseEvents(response)

    expect(events).toEqual([
      { type: 'chunk', content: '你好' },
      { type: 'chunk', content: '，一起探索吧！' },
      { type: 'warning', warning: '本条回复未能保存到历史记录。' },
      { type: 'done', reply: '你好，一起探索吧！' },
    ])
    expect(refundAiCreditMock).toHaveBeenCalledWith(client, 1, 'free')
    expect(conversationUpdate).not.toHaveBeenCalled()
    expect(afterMock).not.toHaveBeenCalled()
  })
})
