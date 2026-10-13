/** @vitest-environment node */

import { NextRequest, after } from 'next/server'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { DELETE, GET, POST } from '@/app/api/tutor/chat/route'
import { getAiCreditStatusForProfile } from '@/lib/api/ai-credits'
import { archiveTutorChat, beginTutorRequest, completeTutorRequest, failTutorRequest, fallbackTutorUsageToFree, getTutorChatSession } from '@/lib/ai/tutor/requests'
import { AuthError, requireAuth } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import {
  validateContentSafeIfPresent,
  validateOwnedOrTrustedImageUrlFromSources,
} from '@/lib/api/validation'
import { finalizeReplyAudio, findSpeciesAudiosForMessage, findSpeciesAudiosMentionedInText, planTutorAudioAttachment } from '@/lib/ai/tutor/audio-tags'
import { buildTutorSceneContext } from '@/lib/ai/tutor/context-builders'
import {
  getTutorEngineUserMessage,
  streamChatWithTutor,
  type TutorEngineMessage,
  type TutorEngineOptions,
} from '@/lib/ai/tutor/engine'
import { buildTutorGreeting } from '@/lib/ai/tutor/greeting'
import { loadTutorNotebook } from '@/lib/ai/tutor/memory'
import { maybeUpdateTutorNotebook, maybeUpdateTutorConversationSummary } from '@/lib/ai/tutor/memory'
import type { DashScopeTokenUsage, DashScopeUsageObserver } from '@/lib/ai/dashscope'
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
vi.mock('@/lib/ai/tutor/guarded-speech', async () => {
  const speech = await import('@/lib/ai/tutor/speech')
  return { createGuardedTutorSpeechStreamer: (_userId: string, options: Parameters<typeof speech.createTutorSpeechStreamer>[0]) => speech.createTutorSpeechStreamer(options) }
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
  getAiCreditStatusForProfile: vi.fn(),
}))

vi.mock('@/lib/ai/tutor/requests', () => ({ archiveTutorChat: vi.fn(), beginTutorRequest: vi.fn(), completeTutorRequest: vi.fn(), failTutorRequest: vi.fn(), fallbackTutorUsageToFree: vi.fn(), getTutorChatSession: vi.fn() }))

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
const EXECUTOR_ID = '44444444-4444-4444-8444-444444444444'
let billingOverride: Record<string, unknown> | null = null
const CONVERSATION_ID = '22222222-2222-2222-2222-222222222222'
const PROFILE = {
  membership_tier: null,
  membership_period: null,
  membership_started_at: null,
  membership_expires_at: null,
}
const QUOTA = {
  creditUnit: 'credits' as const,
  isMember: false,
  walletBalance: 0,
  monthlyGrant: 0,
  freeDaily: 300,
  freeUsedToday: 60,
  freeRemainingToday: 240,
  dailyChargeCap: 100,
  dailyPeriod: '2026-10-12',
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
  previousMessages?: Array<Record<string, unknown>>
  previousError?: boolean
  insertError?: Error | null
  updateConversationError?: Error | null
}

function recordModelUsage(observer: DashScopeUsageObserver | undefined, usage: DashScopeTokenUsage | null, maxTokens = 8192) {
  const handle = observer?.start({ role: 'tutor-text', model: 'qwen-flash',
    payload: { messages: [{ role: 'user', content: 'model input' }], max_tokens: maxTokens } })
  handle?.finish({ usage, status: 'completed' })
}

function createTutorSupabaseMock(options: SupabaseOptions = {}) {
  const user = options.user === undefined ? { id: USER_ID } : options.user
  const profile = options.profile === undefined ? PROFILE : options.profile
  const conversation = options.conversation === undefined ? CONVERSATION : options.conversation

  vi.mocked(getTutorChatSession).mockResolvedValue({ epoch: 0, conversation: conversation as never })
  vi.mocked(completeTutorRequest).mockImplementation(async (_userId, _requestId, input) => {
    if (options.insertError) throw options.insertError
    const billing = billingOverride ?? { source: 'free', chargedCredits: 0, receiptId: 41 }
    return { status: 'completed', conversationId: CONVERSATION_ID,
      message: { role: 'assistant', content: input.reply, meta: { ...input.assistantMeta, billing } } as never }
  })
  const profileMaybeSingle = vi.fn().mockResolvedValue({ data: profile, error: null })
  const profileEq = vi.fn(() => ({ maybeSingle: profileMaybeSingle }))
  const profileSelect = vi.fn(() => ({ eq: profileEq }))

  const conversationMaybeSingle = vi.fn().mockResolvedValue({ data: conversation, error: null })
  const conversationLimit = vi.fn(() => ({ maybeSingle: conversationMaybeSingle }))
  const conversationOrder = vi.fn(() => ({ limit: conversationLimit }))
  const fourthConversationEq = vi.fn(() => ({ order: conversationOrder, maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'previous-id' }, error: options.previousError ? new Error('unavailable') : null }) }))
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
  const previousLimit = vi.fn().mockResolvedValue({ data: options.previousMessages ?? [], error: null })
  const messageEq = vi.fn((_column: string, id: string) => ({ order: id === 'previous-id' ? vi.fn(() => ({ limit: previousLimit })) : messageOrder }))
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
    conversationSelect,
    firstConversationEq,
    secondConversationEq,
    thirdConversationEq,
    fourthConversationEq,
    previousLimit,
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
    beginMock.mockReset().mockResolvedValue({ status: 'started', executorId: EXECUTOR_ID, conversation: CONVERSATION as never, receiptId: 41, maxOutputTokens: 8192, maxTotalTokens: 131072 })
    completeMock.mockReset()
    failMock.mockReset().mockResolvedValue({ status: 'failed' })
    vi.mocked(fallbackTutorUsageToFree).mockReset().mockResolvedValue(null)
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
    vi.mocked(maybeUpdateTutorNotebook).mockReset().mockResolvedValue(undefined)
    vi.mocked(maybeUpdateTutorConversationSummary).mockReset().mockResolvedValue(undefined)
    getTutorEngineUserMessageMock.mockReturnValue('小迪暂时不可用，请稍后再试。')
    streamChatWithTutorMock.mockImplementation(async function* (_prompt, _history, options) {
      recordModelUsage(options?.usageObserver, { promptTokens: 2000, completionTokens: 100, totalTokens: 2100 }, options?.maxTokens)
      options?.onTelemetry?.({model: 'qwen-flash', usage: {promptTokens: 2000, completionTokens: 100, totalTokens: 2100}, visionFallback: false})
      yield '你好'
      yield '，一起探索吧！'
      return '你好，一起探索吧！'
    })
  })

  it('closes speech input before slow memory maintenance and only finishes it once', async () => {
    const db = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(db.client as never)
    let releaseMemory!: () => void
    const memory = new Promise<void>(resolve => { releaseMemory = resolve })
    vi.mocked(maybeUpdateTutorNotebook).mockReturnValue(memory)
    const finish = vi.fn().mockResolvedValue(true)
    vi.mocked(createTutorSpeechStreamer).mockReturnValue({ start: vi.fn(), push: vi.fn(), finish, abort: vi.fn() })
    completeMock.mockResolvedValue({ status: 'completed', message: { content: '你好，一起探索吧！', meta: {} } } as never)
    const draining = readSseEvents(await POST(createPostRequest({ contextType: 'global', content: '你好', speak: true })))
    try {
      await vi.waitFor(() => expect(maybeUpdateTutorNotebook).toHaveBeenCalled())
      expect(finish).toHaveBeenCalledTimes(1)
      expect(completeMock).not.toHaveBeenCalled()
    } finally { releaseMemory() }
    await draining
    expect(finish).toHaveBeenCalledTimes(1)
  })

  it('reads only the authenticated previous active conversation and caps text at four messages / 1500 chars', async () => {
    const db = createTutorSupabaseMock({ previousMessages: Array.from({ length: 6 }, (_, i) => ({
      role: i % 2 ? 'user' : 'assistant', content: `${i}` + '字'.repeat(399), images: ['/private.png'],
    })) })
    createClientMock.mockResolvedValue(db.client as never)
    await readSseEvents(await POST(createPostRequest({ contextType: 'project', contextId: 'new', content: '继续', previousContext: { contextType: 'project', contextId: 'old' } })))
    const history = streamChatWithTutorMock.mock.calls[0][1]
    expect(history[0].content).toContain('上一个页面（project）')
    const previous = history.slice(1, -1)
    expect(previous).toHaveLength(4)
    expect(previous.reduce((total, m) => total + m.content.length, 0)).toBe(1500)
    expect(previous.every((m) => !m.images)).toBe(true)
    expect(previous.at(-1)?.content.startsWith('0')).toBe(true)
    expect(db.previousLimit).toHaveBeenCalledWith(4)
    expect(db.firstConversationEq).toHaveBeenCalledWith('user_id', USER_ID)
    expect(db.secondConversationEq).toHaveBeenCalledWith('context_type', 'project')
    expect(db.thirdConversationEq).toHaveBeenCalledWith('context_id', 'old')
    expect(db.fourthConversationEq).toHaveBeenCalledWith('status', 'active')
    expect(getTutorChatSession).not.toHaveBeenCalled()
    expect(db.messageInsert).not.toHaveBeenCalled()
    expect(db.conversationUpdate).not.toHaveBeenCalled()
    expect(beginMock).toHaveBeenCalledTimes(1)
  })

  it.each([undefined, { contextType: 'project', contextId: 'new' }])('ignores absent or same-session previousContext %s', async (previousContext) => {
    const db = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(db.client as never)
    await readSseEvents(await POST(createPostRequest({ contextType: 'project', contextId: 'new', content: '继续', previousContext })))
    expect(db.conversationSelect).not.toHaveBeenCalled()
    expect(streamChatWithTutorMock.mock.calls[0][1].map((m) => m.content)).toEqual(['继续'])
  })

  it('sanitizes previous assistant text while keeping user text and current history after it', async () => {
    const db = createTutorSupabaseMock({
      previousMessages: [{ role: 'assistant', content: '<think>内部分析</think>可以观察气泡。' }, { role: 'user', content: '标签 <think> 是什么？' }],
      recentMessages: [{ role: 'assistant', content: '本页回复' }],
    })
    createClientMock.mockResolvedValue(db.client as never)
    await readSseEvents(await POST(createPostRequest({ content: '继续', previousContext: { contextType: 'project', contextId: 'old' } })))
    expect(streamChatWithTutorMock.mock.calls[0][1].slice(1).map((m) => m.content)).toEqual(['标签 <think> 是什么？', '可以观察气泡。', '本页回复', '继续'])
  })

  it('silently ignores previous-context query failures', async () => {
    const db = createTutorSupabaseMock({ previousError: true })
    createClientMock.mockResolvedValue(db.client as never)
    const events = await readSseEvents(await POST(createPostRequest({ content: '继续', previousContext: { contextType: 'project', contextId: 'old' } })))
    expect(events.some((event) => event.type === 'done')).toBe(true)
    expect(streamChatWithTutorMock.mock.calls[0][1].map((m) => m.content)).toEqual(['继续'])
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
    expect(events).toEqual([{ type: 'done', reply: '原回复', billing: { source: 'wallet', chargedCredits: .1, receiptId: 41 }, replayed: true }])
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
      error: '可用代币不足，请明天使用新的赠送代币。',
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
    expect(afterMock).not.toHaveBeenCalled()
    expect(vi.mocked(maybeUpdateTutorNotebook).mock.invocationCallOrder[0]).toBeLessThan(completeMock.mock.invocationCallOrder[0])
    expect(completeMock).toHaveBeenCalledWith(USER_ID, REQUEST_ID, expect.objectContaining({ usage: expect.objectContaining({ totalTokens: 2100, pendingCalls: 0 }) }))
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

  it('settles verified request usage after image fallback and keeps raw usage out of message metadata', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    beginMock.mockResolvedValue({
      status: 'started', executorId: EXECUTOR_ID, conversation: CONVERSATION as never,
      receiptId: 41,
      maxOutputTokens: 8192, maxTotalTokens: 131072,
    })
    streamChatWithTutorMock.mockImplementation(async function* (
      _systemPrompt: string,
      _history: TutorEngineMessage[],
      options?: TutorEngineOptions,
    ): AsyncGenerator<string, string, undefined> {
      options?.onVisionFallback?.()
      recordModelUsage(options?.usageObserver, { promptTokens: 221, completionTokens: 100, totalTokens: 321 })
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

    // The verified provider call includes both its input and output.
    expect(beginMock).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ requestId: REQUEST_ID, epoch: 0 }))
    expect(completeMock).toHaveBeenCalledTimes(1)
    expect(completeMock).toHaveBeenCalledWith(USER_ID, REQUEST_ID, expect.objectContaining({ usage: expect.objectContaining({ inputTokens: 221, outputTokens: 100, totalTokens: 321 }) }))
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'warning', warning: expect.stringContaining('图片') }),
    )
    expect(events).toContainEqual(expect.objectContaining({ type: 'done', reply: '我先按文字帮你分析。' }))
    // Raw accounting goes through the private transaction argument only.
    const saved = completeMock.mock.calls[0][2]
    expect(saved.assistantMeta).toMatchObject({
      ai: {
        promptVersion: expect.stringMatching(/^\d{8}\.\d+$/),
        model: 'qwen-flash',
        visionFallback: true,
      },
    })
    expect(saved.meta).not.toHaveProperty('ai')
    expect(saved.assistantMeta.ai).not.toHaveProperty('usage')
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
    beginMock.mockResolvedValue({ status: 'started', executorId: EXECUTOR_ID, conversation: CONVERSATION as never, maxOutputTokens: 8192, maxTotalTokens: 131072, receiptId: 42 })
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
  it.each([100, 2500])('settles input plus all output for %i visible-answer tokens without double counting reasoning', async (tokens) => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    beginMock.mockResolvedValue({ status: 'started', executorId: EXECUTOR_ID, conversation: CONVERSATION as never, receiptId: 41, maxOutputTokens: 8192, maxTotalTokens: 131072 })
    const totalTokens = 15000 + tokens + 500
    const billing = { source: 'wallet' as const, chargedCredits: totalTokens / 100, receiptId: 41 }
    billingOverride = billing
    streamChatWithTutorMock.mockImplementation(async function* (_prompt, _history, options) {
      recordModelUsage(options?.usageObserver, { promptTokens: 15000, completionTokens: tokens + 500, reasoningTokens: 500 })
      options?.onTelemetry?.({ model: 'qwen-flash', usage: { promptTokens: 15000, completionTokens: tokens + 500, reasoningTokens: 500 }, visionFallback: false })
      yield '这是回答'
      return '这是回答'
    })
    const events = await readSseEvents(await POST(createPostRequest({ content: '请解释', outputTokens: 999999 })))
    expect(completeMock).toHaveBeenCalledWith(USER_ID, REQUEST_ID, expect.objectContaining({ usage: expect.objectContaining({ totalTokens }) }))
    expect(events).toContainEqual({ type: 'done', reply: '这是回答', billing })
    expect(completeMock.mock.calls[0][2].assistantMeta.ai).toMatchObject({ creditReceiptId: 41 })
    expect(JSON.stringify(events)).not.toMatch(/inputTokens|outputTokens|totalTokens|usageMissing/)
  })

  it('does not charge guessed tokens when provider usage is missing', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    beginMock.mockResolvedValue({ status: 'started', executorId: EXECUTOR_ID, conversation: CONVERSATION as never, receiptId: 41, maxOutputTokens: 8192, maxTotalTokens: 131072 })
    billingOverride = { source: 'wallet', chargedCredits: 0, receiptId: 41 }
    streamChatWithTutorMock.mockImplementation(async function* (_prompt, _history, options) {
      recordModelUsage(options?.usageObserver, null)
      yield '回答'; return '回答'
    })
    const events = await readSseEvents(await POST(createPostRequest({ content: '问一下' })))
    expect(completeMock).toHaveBeenCalledWith(USER_ID, REQUEST_ID, expect.objectContaining({ usage: expect.objectContaining({ totalTokens: 0, usageMissing: true }) }))
    expect(events).toContainEqual(expect.objectContaining({ type: 'warning', warning: expect.stringContaining('未收取代币') }))
  })

  it('passes the reserved low wallet budget to the model', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    beginMock.mockResolvedValue({ status: 'started', executorId: EXECUTOR_ID, conversation: CONVERSATION as never, receiptId: 41, maxOutputTokens: 125, maxTotalTokens: 131072 })
    await readSseEvents(await POST(createPostRequest({ content: '问一下' })))
    expect(streamChatWithTutorMock).toHaveBeenCalledWith(expect.any(String), expect.any(Array), expect.objectContaining({ maxTokens: 125 }))
    expect(completeMock).toHaveBeenCalledOnce()
  })

  it('settles actual planner work for a successful clarification and returns only the credit receipt', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    vi.mocked(planTutorResourceSearch).mockImplementationOnce(async (_content, options) => {
      recordModelUsage(options?.usageObserver, { promptTokens: 100, completionTokens: 20 })
      return { status: 'model', shouldSearch: false, queries: [], resourceTypes: ['project'],
        clarification: { prompt: '想做什么实验？', options: [{ id: 'science', label: '科学实验', value: '科学实验' }, { id: 'build', label: '搭建', value: '搭建' }] } }
    })
    billingOverride = { source: 'wallet', chargedCredits: 1.2, receiptId: 41 }
    const events = await readSseEvents(await POST(createPostRequest({ content: '推荐一个' })))
    expect(completeMock).toHaveBeenCalledWith(USER_ID, REQUEST_ID, expect.objectContaining({ clarification: true, usage: expect.objectContaining({ totalTokens: 120 }) }))
    expect(events).toContainEqual({ type: 'done', reply: '想做什么实验？', billing: billingOverride })
    expect(streamChatWithTutorMock).not.toHaveBeenCalled()
  })

  it('releases a clarification hold instead of committing a pending model attempt', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    vi.mocked(planTutorResourceSearch).mockImplementationOnce(async (_content, options) => {
      options?.usageObserver?.start({ role: 'tutor-planner', model: 'qwen-flash', payload: { messages: [], max_tokens: 100 } })
      return { status: 'model', shouldSearch: false, queries: [], resourceTypes: ['project'],
        clarification: { prompt: '想做什么实验？', options: [{ id: 'science', label: '科学实验', value: '科学实验' }, { id: 'build', label: '搭建', value: '搭建' }] } }
    })
    const response = await POST(createPostRequest({ content: '推荐一个' }))
    expect(response.status).toBe(500)
    expect(completeMock).not.toHaveBeenCalled()
    expect(failMock).toHaveBeenCalledExactlyOnceWith(USER_ID, REQUEST_ID)
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
    expect(payload.messages[0].billing).toEqual({ source: 'wallet', chargedCredits: 0.123, receiptId: 41 })
  })

  it('includes verified total usage even when reasoning text was filtered without a separate reasoning count', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    streamChatWithTutorMock.mockImplementation(async function* (_prompt, _history, options) {
      recordModelUsage(options?.usageObserver, { promptTokens: 300, completionTokens: 500 })
      options?.onTelemetry?.({ model: 'qwen-flash', usage: { promptTokens: 300, completionTokens: 500 }, visionFallback: false, outputSanitized: true })
      yield '可见回答'; return '可见回答'
    })
    await readSseEvents(await POST(createPostRequest({ content: '问题' })))
    expect(completeMock).toHaveBeenCalledWith(USER_ID, REQUEST_ID, expect.objectContaining({ usage: expect.objectContaining({ totalTokens: 800 }) }))
  })

  it('can save and settle the answer when optional memory maintenance fails', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    vi.mocked(maybeUpdateTutorNotebook).mockRejectedValueOnce(new Error('bookkeeping unavailable'))
    const events = await readSseEvents(await POST(createPostRequest({ content: '问题' })))
    expect(events.some(event => event.type === 'error')).toBe(false)
    expect(events).toContainEqual(expect.objectContaining({ type: 'done', reply: '你好，一起探索吧！' }))
    expect(completeMock).toHaveBeenCalledOnce()
  })

  it('includes resource planning and both memory calls in the same finalized request usage', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    vi.mocked(planTutorResourceSearch).mockImplementationOnce(async (_content, options) => {
      recordModelUsage(options?.usageObserver, { promptTokens: 300, completionTokens: 10 })
      return { status: 'model', shouldSearch: false, queries: [], resourceTypes: ['project'] }
    })
    vi.mocked(maybeUpdateTutorNotebook).mockImplementationOnce(async (userId, options) => {
      expect(userId).toBe(USER_ID)
      recordModelUsage(options?.usageObserver, { promptTokens: 1000, completionTokens: 50 })
    })
    vi.mocked(maybeUpdateTutorConversationSummary).mockImplementationOnce(async (conversationId, userId, options) => {
      expect([conversationId, userId]).toEqual([CONVERSATION_ID, USER_ID])
      recordModelUsage(options?.usageObserver, { promptTokens: 500, completionTokens: 25 })
    })
    billingOverride = { source: 'wallet', chargedCredits: 39.85, receiptId: 41 }
    const events = await readSseEvents(await POST(createPostRequest({ content: '继续解释' })))
    const usage = completeMock.mock.calls[0][2].usage
    expect(usage).toMatchObject({ inputTokens: 3800, outputTokens: 185, totalTokens: 3985, pendingCalls: 0, usageMissing: false })
    expect(usage.calls.map(call => call.purpose)).toEqual(['resource_planner', 'main_reply', 'notebook_summary', 'conversation_summary'])
    expect(events).toContainEqual(expect.objectContaining({ type: 'done', billing: billingOverride }))
    expect(JSON.stringify(events)).not.toMatch(/totalTokens|inputTokens|outputTokens|usageMissing|notebook_summary/)
    expect(afterMock).not.toHaveBeenCalled()
  })

  it('settles verified background work even when the answer provider omits usage', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    vi.mocked(planTutorResourceSearch).mockImplementationOnce(async (_content, options) => {
      recordModelUsage(options?.usageObserver, { promptTokens: 100, completionTokens: 20 })
      return { status: 'model', shouldSearch: false, queries: [], resourceTypes: ['project'] }
    })
    streamChatWithTutorMock.mockImplementation(async function* (_prompt, _history, options) {
      recordModelUsage(options?.usageObserver, null)
      yield '回答'; return '回答'
    })
    billingOverride = { source: 'wallet', chargedCredits: 1.2, receiptId: 41 }
    const events = await readSseEvents(await POST(createPostRequest({ content: '问一下' })))
    expect(completeMock.mock.calls[0][2].usage).toMatchObject({ totalTokens: 120, usageMissing: true, pendingCalls: 0 })
    expect(events).toContainEqual(expect.objectContaining({ type: 'warning', warning: expect.stringContaining('只收取已确认部分') }))
    expect(events).toContainEqual({ type: 'done', reply: '回答', billing: billingOverride })
  })

  it('waits for an unused early audio planner and includes it with the replacement planner', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    buildTutorSceneContextMock.mockResolvedValue({ ...SCENE, sceneCapabilities: ['speciesAudio'] })
    vi.mocked(findSpeciesAudiosForMessage).mockResolvedValueOnce([{ slug: 'old', label: '旧鸟鸣', audioUrl: '/old.mp3' }])
    vi.mocked(findSpeciesAudiosMentionedInText).mockResolvedValueOnce([{ slug: 'new', label: '新鸟鸣', audioUrl: '/new.mp3' }])
    let finishEarly!: () => void
    const earlyReady = new Promise<void>(resolve => { finishEarly = resolve })
    vi.mocked(planTutorAudioAttachment).mockImplementationOnce(async (_content, _reply, _audios, options) => {
      const handle = options?.usageObserver?.start({ role: 'tutor-planner', model: 'qwen-flash', payload: { messages: [], max_tokens: 120 } })
      await earlyReady
      handle?.finish({ usage: { promptTokens: 120, completionTokens: 10 }, status: 'completed' })
      return null
    }).mockImplementationOnce(async (_content, _reply, _audios, options) => {
      recordModelUsage(options?.usageObserver, { promptTokens: 125, completionTokens: 15 }, 120)
      return null
    })
    const reading = readSseEvents(await POST(createPostRequest({ content: '听听鸟鸣' })))
    await vi.waitFor(() => expect(planTutorAudioAttachment).toHaveBeenCalledTimes(1))
    expect(completeMock).not.toHaveBeenCalled()
    finishEarly()
    await reading
    expect(planTutorAudioAttachment).toHaveBeenCalledTimes(2)
    const usage = completeMock.mock.calls[0][2].usage
    expect(usage).toMatchObject({ totalTokens: 2370, pendingCalls: 0 })
    expect(usage.calls.filter(call => call.purpose === 'audio_planner')).toHaveLength(2)
  })

  it('does not commit a bill while a model attempt is still pending', async () => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    streamChatWithTutorMock.mockImplementation(async function* (_prompt, _history, options) {
      options?.usageObserver?.start({ role: 'tutor-text', model: 'qwen-flash', payload: { messages: [], max_tokens: 100 } })
      yield '回答'; return '回答'
    })
    const events = await readSseEvents(await POST(createPostRequest({ content: '问一下' })))
    expect(events).toContainEqual(expect.objectContaining({ type: 'error', requestState: 'failed' }))
    expect(completeMock).not.toHaveBeenCalled()
    expect(failMock).toHaveBeenCalledWith(USER_ID, REQUEST_ID)
  })

  it.each([true, false])('uses the admitted executor for low-wallet free recovery (accepted: %s)', async (accepted) => {
    const { client } = createTutorSupabaseMock()
    createClientMock.mockResolvedValue(client as never)
    beginMock.mockResolvedValue({ status: 'started', executorId: EXECUTOR_ID, conversation: CONVERSATION as never,
      receiptId: 41, maxOutputTokens: 8192, maxTotalTokens: 2000 })
    vi.mocked(fallbackTutorUsageToFree).mockResolvedValue(accepted ? { maxTotalTokens: 30000 } : null)
    vi.mocked(planTutorResourceSearch).mockImplementationOnce(async (_content, options) => {
      recordModelUsage(options?.usageObserver, { promptTokens: 1000, completionTokens: 50 }, 100)
      return { status: 'model', shouldSearch: false, queries: [], resourceTypes: ['project'] }
    })
    let mainProviderCalls = 0
    streamChatWithTutorMock.mockImplementation(async function* (_prompt, _history, options) {
      const observer = options!.usageObserver!
      const input: Parameters<DashScopeUsageObserver['start']>[0] = {
        role: 'tutor-text', model: 'qwen-flash',
        payload: { messages: [{ role: 'user', content: 'x'.repeat(2000) }], max_tokens: 8192 },
      }
      let handle
      try { handle = observer.start(input) }
      catch (error) {
        if (!await observer.recoverBudget?.(input, error)) throw error
        handle = observer.start(input)
      }
      mainProviderCalls += 1
      handle.finish({ usage: { promptTokens: 2500, completionTokens: 100 }, status: 'completed' })
      yield '恢复后的回答'; return '恢复后的回答'
    })
    billingOverride = { source: 'free', chargedCredits: 36.5, receiptId: 41 }
    const events = await readSseEvents(await POST(createPostRequest({ content: '继续解释' })))
    expect(fallbackTutorUsageToFree).toHaveBeenCalledExactlyOnceWith(USER_ID, REQUEST_ID, {
      receiptId: 41, executorId: EXECUTOR_ID, minimumTotalTokens: expect.any(Number),
    })
    expect(vi.mocked(fallbackTutorUsageToFree).mock.calls[0][2].minimumTotalTokens).toBeGreaterThan(2000)
    expect(mainProviderCalls).toBe(accepted ? 1 : 0)
    if (accepted) {
      expect(completeMock.mock.calls[0][2].usage).toMatchObject({ totalTokens: 3650, pendingCalls: 0 })
      expect(completeMock.mock.calls[0][2].usage.calls.map(call => call.purpose)).toEqual(['resource_planner', 'main_reply'])
      expect(events).toContainEqual({ type: 'done', reply: '恢复后的回答', billing: billingOverride })
      expect(failMock).not.toHaveBeenCalled()
    } else {
      expect(completeMock).not.toHaveBeenCalled()
      expect(failMock).toHaveBeenCalledExactlyOnceWith(USER_ID, REQUEST_ID)
      expect(events).toContainEqual(expect.objectContaining({ type: 'error', requestState: 'failed' }))
    }
    expect(JSON.stringify(events)).not.toMatch(/executorId|minimumTotalTokens|totalTokens|budgetDeniedCalls/)
  })

})
