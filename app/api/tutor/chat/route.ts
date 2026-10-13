import { getTutorVoiceAccess } from '@/lib/ai/tutor/voice-access'
import { NextRequest, NextResponse } from 'next/server'

import { buildTutorSceneContext } from '@/lib/ai/tutor/context-builders'
import {
  finalizeReplyAudio,
  findSpeciesAudiosForMessage,
  findSpeciesAudiosMentionedInText,
  planTutorAudioAttachment,
  type TutorAudioRef,
} from '@/lib/ai/tutor/audio-tags'
import {
  buildSpeciesHintsSummary,
  findSpeciesHintsForText,
  speciesHintsToAudioRefs,
} from '@/lib/ai/tutor/species-hints'
import {
  streamChatWithTutor,
  getTutorEngineUserMessage,
  type TutorEngineMessage,
  type TutorEngineTelemetry,
} from '@/lib/ai/tutor/engine'
import { buildTutorGreeting } from '@/lib/ai/tutor/greeting'
import {
  loadTutorNotebook,
  maybeUpdateTutorConversationSummary,
  maybeUpdateTutorNotebook,
} from '@/lib/ai/tutor/memory'
import { planTutorToolDecision, shouldPlanTutorToolDecision } from '@/lib/ai/tutor/tool-call-planner'
import { buildTutorSystemPrompt, TUTOR_PROMPT_VERSION } from '@/lib/ai/tutor/prompt'
import { buildTutorReplyFocusSummary } from '@/lib/ai/tutor/reply-focus'
import {
  formatTutorResourceSearch,
  searchTutorResources,
} from '@/lib/ai/tutor/resource-search'
import { sanitizeTutorReply } from '@/lib/ai/tutor/reasoning-output'
import { validateTutorResourceTags } from '@/lib/ai/tutor/resource-links'
import { normalizeTutorResourceClarification } from '@/lib/ai/tutor/resource-clarification'
import { planTutorResourceSearch } from '@/lib/ai/tutor/resource-search-planner'
import { diagnoseScratchScreenshot, shouldDiagnoseScratchScreenshot } from '@/lib/ai/tutor/scratch-screenshot-diagnosis'
import { hasTutorSceneCapability, resolveTutorSceneCapabilities } from '@/lib/ai/tutor/scene-capabilities'
import { buildStudentProfile } from '@/lib/ai/tutor/student-profile'
import type { TutorToolCall } from '@/lib/ai/tutor/tool-calls'
import { buildTutorToolCallsFromPlan } from '@/lib/ai/tutor/tool-registry'
import {
  TUTOR_CONTEXT_TYPES,
  TUTOR_GLOBAL_SURFACES,
  TUTOR_PLAYGROUND_GAME_KEYS,
  type TutorContextType,
  type TutorGlobalSurface,
  type TutorPlaygroundGameKey,
} from '@/lib/ai/tutor/types'
import { logger } from '@/lib/logger'
import { getAiCreditStatusForProfile } from '@/lib/api/ai-credits'
import { archiveTutorChat, beginTutorRequest, completeTutorRequest, failTutorRequest, fallbackTutorUsageToFree, getTutorChatSession, type TutorRequestResult } from '@/lib/ai/tutor/requests'
import { parseTutorBilling, TUTOR_CREDIT_EXHAUSTED_MESSAGE } from '@/lib/ai/tutor/billing'
import { createTutorUsageCollector } from '@/lib/ai/tutor/usage'
import type { TutorBilling } from '@/lib/ai/tutor/types'
import { handleApiError, requireAuth } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import {
  ValidationError,
  validateContentSafeIfPresent,
  validateOwnedOrTrustedImageUrlFromSources,
} from '@/lib/api/validation'
import {
  AI_TUTOR_RATE_LIMIT_PER_MINUTE,
} from '@/lib/membership'
import { TutorSendSchema, type TutorSendInput } from '@/lib/schemas'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import { createGuardedTutorSpeechStreamer as createTutorSpeechStreamer } from '@/lib/ai/tutor/guarded-speech'

const HISTORY_LIMIT = 200
const CONTEXT_TURNS = 12
/**
 * 送入模型的历史窗口按字符预算截断（中文里字符数与 token 同量级）。
 * 固定条数无法约束贴长文的情况；预算内至少保留最近一问一答。
 */
const HISTORY_CHAR_BUDGET = 6000
/** 历史消息里每张图片按固定字符成本估算（缩略引用 + 模型侧摘要开销） */
const HISTORY_IMAGE_CHAR_COST = 400
const TUTOR_TIMING_ENABLED = process.env.NODE_ENV === 'development' || process.env.TUTOR_DEBUG_TIMING === '1'

type TutorTimingMark = {
  name: string
  elapsedMs: number
  deltaMs: number
}

function createTutorTimingTrace(label: string) {
  const startedAt = Date.now()
  let lastAt = startedAt
  const marks: TutorTimingMark[] = []

  const mark = (name: string) => {
    if (!TUTOR_TIMING_ENABLED) return
    const now = Date.now()
    marks.push({
      name,
      elapsedMs: now - startedAt,
      deltaMs: now - lastAt,
    })
    lastAt = now
  }

  const snapshot = () => marks.map((item) => ({ ...item }))

  const serverTiming = () => {
    if (!TUTOR_TIMING_ENABLED || marks.length === 0) return undefined
    return marks
      .slice(0, 12)
      .map((item) => `${item.name.replace(/[^a-zA-Z0-9_-]/g, '_')};dur=${Math.max(0, item.deltaMs)}`)
      .join(', ')
  }

  const log = (outcome: string, context?: Record<string, unknown>) => {
    if (!TUTOR_TIMING_ENABLED) return
    console.info('[tutor timing]', {
      label,
      outcome,
      totalMs: Date.now() - startedAt,
      marks: snapshot(),
      ...context,
    })
  }

  return { mark, snapshot, serverTiming, log }
}

function mergeTutorAudios(...groups: TutorAudioRef[][]) {
  const merged = new Map<string, TutorAudioRef>()
  for (const group of groups) {
    for (const audio of group) {
      if (!merged.has(audio.slug)) merged.set(audio.slug, audio)
    }
  }
  return [...merged.values()]
}
/** 小迪可接收的图片来源：PBL 阶段产出、自然观察照片、聊天直传 */
const TUTOR_IMAGE_SOURCES = [
  { bucket: 'project-completions', pathPrefix: 'challenge-submissions' },
  { bucket: 'project-images', pathPrefix: 'observations' },
  { bucket: 'project-images', pathPrefix: 'tutor-chat' },
]

type TutorMessageRow = Database['public']['Tables']['tutor_messages']['Row']

function parseContextParams(searchParams: URLSearchParams) {
  const contextTypeRaw = searchParams.get('contextType') || 'global'
  // 非法值回退 global，避免直接 cast 后在场景构建里抛错
  const contextType: TutorContextType = TUTOR_CONTEXT_TYPES.includes(contextTypeRaw as TutorContextType)
    ? (contextTypeRaw as TutorContextType)
    : 'global'
  const contextId = searchParams.get('contextId') || ''
  const stageIndexRaw = searchParams.get('stageIndex')
  const stageIndex = stageIndexRaw != null ? Number.parseInt(stageIndexRaw, 10) : undefined
  const lessonIdRaw = searchParams.get('lessonId')
  const lessonId = lessonIdRaw != null ? Number.parseInt(lessonIdRaw, 10) : undefined
  const surfaceRaw = searchParams.get('surface')
  const surface = TUTOR_GLOBAL_SURFACES.includes(surfaceRaw as TutorGlobalSurface)
    ? (surfaceRaw as TutorGlobalSurface)
    : undefined
  const gameKeyRaw = searchParams.get('gameKey')
  const gameKey =
    surface === 'playground' && TUTOR_PLAYGROUND_GAME_KEYS.includes(gameKeyRaw as TutorPlaygroundGameKey)
      ? (gameKeyRaw as TutorPlaygroundGameKey)
      : undefined
  return {
    contextType,
    contextId,
    stageIndex: Number.isNaN(stageIndex ?? NaN) ? undefined : stageIndex,
    lessonId: Number.isNaN(lessonId ?? NaN) ? undefined : lessonId,
    surface,
    gameKey,
  }
}

function mapMessage(row: TutorMessageRow) {
  const meta = (row.meta ?? {}) as Record<string, unknown>
  const clarification = normalizeTutorResourceClarification(meta.clarification)
  return {
    role: row.role as 'user' | 'assistant',
    ...(typeof meta.requestId === 'string' ? { requestId: meta.requestId } : {}),
    content: row.role === 'assistant' ? sanitizeTutorReply(row.content) : row.content,
    images: row.images ?? undefined,
    stageIndex: typeof meta.stageIndex === 'number' ? meta.stageIndex : undefined,
    ...(clarification ? { clarification } : {}),
    ...(row.role === 'assistant' && parseTutorBilling(meta.billing) ? { billing: parseTutorBilling(meta.billing) } : {}),
  }
}

function mapPlannerHistoryMessage(row: TutorMessageRow) {
  const meta = (row.meta ?? {}) as Record<string, unknown>
  const clarification = normalizeTutorResourceClarification(meta.clarification)
  const safeContent = row.role === 'assistant' ? sanitizeTutorReply(row.content) : row.content
  const content = clarification
    ? [
        safeContent,
        `【小迪上一轮给出的选项】${clarification.options.map((option) => option.label).join(' / ')}`,
      ].filter(Boolean).join('\n')
    : safeContent

  return {
    role: row.role as 'user' | 'assistant',
    content,
  }
}

function buildConversationMeta(input: {
  stageIndex?: number
  lessonId?: number
  lessonStepIndex?: number
  lessonStepCount?: number
  scratchBlockTargetItemIndex?: number
  surface?: TutorGlobalSurface
  gameKey?: TutorPlaygroundGameKey
}) {
  const meta: Record<string, unknown> = {}
  if (typeof input.stageIndex === 'number') meta.stageIndex = input.stageIndex
  if (typeof input.lessonId === 'number') meta.lessonId = input.lessonId
  if (typeof input.lessonStepIndex === 'number') meta.lessonStepIndex = input.lessonStepIndex
  if (typeof input.lessonStepCount === 'number') meta.lessonStepCount = input.lessonStepCount
  if (typeof input.scratchBlockTargetItemIndex === 'number') {
    meta.scratchBlockTargetItemIndex = input.scratchBlockTargetItemIndex
  }
  if (input.surface) meta.surface = input.surface
  if (input.gameKey) meta.gameKey = input.gameKey
  return meta
}

function completedRequestEvents(result: Extract<TutorRequestResult, { status: 'completed' }>) {
  const message = mapMessage(result.message)
  return [
    ...(message.clarification ? [{ type: 'clarification', clarification: message.clarification }] : []),
    { type: 'done', reply: message.content, replayed: true, ...(message.billing ? { billing: message.billing } : {}) },
  ]
}

function requestResultResponse(result: Exclude<TutorRequestResult, { status: 'started' }>) {
  if (result.status === 'completed') {
    // Replays restore text and billing, never run page tools or play audio again.
    return new Response(completedRequestEvents(result).map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }
  if (result.status === 'rejected' && result.error !== 'quota_exceeded') {
    return NextResponse.json({ error: '对话服务暂未就绪，请稍后重试。', requestState: 'processing' }, { status: 503 })
  }
  const errors = {
    processing: '这次提问仍在处理中，请稍后重试以查看结果。',
    busy: '当前话题还有一条提问正在处理，请稍后再试。',
    failed: '这次提问未完成，可以重新尝试。',
    unavailable: '这条回复已删除，无法恢复。',
    conflict: '提问内容已变化，请重新发送。',
    stale_topic: '话题已更新，请重新打开对话后发送。',
    rejected: TUTOR_CREDIT_EXHAUSTED_MESSAGE,
  }
  return NextResponse.json({ error: errors[result.status], requestState: result.status,
    ...(result.status === 'rejected' ? { code: result.error, resetAt: result.resetAt } : {}),
  }, { status: result.status === 'rejected' && result.error === 'quota_exceeded' ? 402 : 409 })
}

async function loadHistory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversationId: string,
) {
  // 降序取最新 N 条再反转，避免长对话只显示最旧消息。
  const { data, error } = await supabase
    .from('tutor_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('id', { ascending: false })
    .limit(HISTORY_LIMIT)

  if (error) throw error
  return ((data ?? []) as TutorMessageRow[]).reverse().map(mapMessage)
}

const PREVIOUS_CONTEXT_TURNS = 4
const PREVIOUS_CONTEXT_CHAR_BUDGET = 1500

/** Optional continuity only: never create a session or write to the previous page. */
async function loadPreviousContextHistory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  currentType: string,
  currentId: string,
  previous: TutorSendInput['previousContext'],
): Promise<TutorEngineMessage[]> {
  if (!previous || (previous.contextType === currentType && previous.contextId === currentId)) return []
  try {
    const session = await supabase.from('tutor_conversations').select('id')
      .eq('user_id', userId).eq('context_type', previous.contextType)
      .eq('context_id', previous.contextId).eq('status', 'active').maybeSingle()
    if (session.error || !session.data) return []
    const rows = await supabase.from('tutor_messages').select('role, content')
      .eq('conversation_id', session.data.id).order('id', { ascending: false }).limit(PREVIOUS_CONTEXT_TURNS)
    if (rows.error) return []
    const history: TutorEngineMessage[] = []
    let remaining = PREVIOUS_CONTEXT_CHAR_BUDGET
    for (const row of (rows.data ?? []).slice(0, PREVIOUS_CONTEXT_TURNS)) {
      if (remaining <= 0) break
      if (row.role !== 'user' && row.role !== 'assistant') continue
      const content = (row.role === 'assistant' ? sanitizeTutorReply(row.content) : row.content).slice(0, remaining)
      if (!content) continue
      history.unshift({ role: row.role, content })
      remaining -= content.length
    }
    if (history.length) history.unshift({ role: 'user', content: `以下是用户在上一个页面（${previous.contextType}）和你的最近对话，仅供衔接，当前页面以新上下文为准` })
    return history
  } catch {
    return []
  }
}

/** 从最新往旧累计字符成本，超出预算即停；至少保留最近 2 条。 */
function trimHistoryToCharBudget(history: TutorEngineMessage[], budget = HISTORY_CHAR_BUDGET) {
  const kept: TutorEngineMessage[] = []
  let used = 0
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const message = history[i]
    const cost = message.content.length + (message.images?.length ?? 0) * HISTORY_IMAGE_CHAR_COST
    if (kept.length >= 2 && used + cost > budget) break
    kept.unshift(message)
    used += cost
  }
  return kept
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    const { contextType, contextId, stageIndex, lessonId, surface, gameKey } = parseContextParams(request.nextUrl.searchParams)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ messages: [], quota: null, greeting: null })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('membership_tier, membership_period, membership_started_at, membership_expires_at')
      .eq('id', user.id)
      .maybeSingle()

    // 轻量分支：只刷新代币状态，跳过画像/场景/笔记本查询
    if (request.nextUrl.searchParams.get('quotaOnly') === '1') {
      const quota = await getAiCreditStatusForProfile(supabase, profile)
      return NextResponse.json({ quota })
    }

    const [quota, studentProfile, scene, notebook, session] = await Promise.all([
      getAiCreditStatusForProfile(supabase, profile),
      buildStudentProfile(supabase, user.id),
      buildTutorSceneContext(supabase, user.id, contextType, contextId, { stageIndex, lessonId, surface, gameKey }),
      loadTutorNotebook(supabase, user.id),
      getTutorChatSession(user.id, contextType, contextId),
    ])
    // 只读：不在 GET 里创建会话，避免“打开面板就落一条空线程”；首条消息由 POST 创建。
    const conversation = session.conversation
    const messages = conversation ? await loadHistory(supabase, conversation.id) : []

    const greeting = messages.length === 0 ? buildTutorGreeting(studentProfile, scene) : null

    return NextResponse.json({
      messages,
      epoch: session.epoch,
      quota,
      greeting,
      conversation: conversation
        ? {
            id: conversation.id,
            title: conversation.title,
            createdAt: conversation.created_at,
          }
        : null,
      scene: {
        title: scene.title,
        contextType: scene.contextType,
        sceneCapabilities: scene.sceneCapabilities ?? [],
        suggestedImages: scene.suggestedImages ?? [],
      },
      hasNotebook: Boolean(notebook?.trim()),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const { contextType, contextId } = parseContextParams(request.nextUrl.searchParams)
    const rawEpoch = request.nextUrl.searchParams.get('epoch')
    const epoch = rawEpoch == null ? NaN : Number(rawEpoch)
    if (!Number.isSafeInteger(epoch) || epoch < 0) return NextResponse.json({ error: '请刷新对话后重试', code: 'refresh_required' }, { status: 400 })
    const result = await archiveTutorChat(user.id, contextType, contextId, epoch)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const timing = createTutorTimingTrace('api/tutor/chat POST')
  // 扣费成功后、流式响应移交前若抛错，由外层 catch 统一退款
  let pendingRefund: (() => Promise<void>) | null = null
  let commitAttempted = false
  let confirmedFailed = false

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, {
      key: 'api-tutor-chat',
      limit: AI_TUTOR_RATE_LIMIT_PER_MINUTE,
      windowMs: 60_000,
    })
    timing.mark('auth_rate_limit')

    const body = await request.json()
    const parsed = TutorSendSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(', '), code: 'refresh_required' },
        { status: 400 },
      )
    }

    const contextType = parsed.data.contextType
    const contextId = parsed.data.contextId ?? ''
    const content = parsed.data.content.trim()
    const images = parsed.data.images
    const stageIndex = parsed.data.stageIndex
    const lessonId = parsed.data.lessonId
    const lessonStepIndex = parsed.data.lessonStepIndex
    const lessonStepCount = parsed.data.lessonStepCount
    const scratchBlockTargetItemIndex = parsed.data.scratchBlockTargetItemIndex
    const scratchEditorContext = parsed.data.scratchEditorContext
    const clientSceneCapabilities = parsed.data.sceneCapabilities
    const surface = parsed.data.surface
    const gameKey = surface === 'playground' ? parsed.data.gameKey : undefined
    const wantSpeak = parsed.data.speak === true

    validateContentSafeIfPresent(content, '对话内容')
    for (const image of images) {
      validateOwnedOrTrustedImageUrlFromSources(image, user.id, '产出图片', TUTOR_IMAGE_SOURCES)
    }
    timing.mark('parse_validate')

    const creditResult = await beginTutorRequest(user.id, parsed.data)
    if (creditResult.status !== 'started') return requestResultResponse(creditResult)
    const conversation = creditResult.conversation
    const receiptId = creditResult.receiptId
    const release = async () => {
      try {
        const result = await failTutorRequest(user.id, parsed.data.requestId)
        confirmedFailed = result.status === 'failed'
      } catch (error) {
        logger.warn('Tutor request release unconfirmed; retry must retain request identity.', { receiptId, error: String(error) })
      }
    }
    pendingRefund = release
    const usageCollector = createTutorUsageCollector({
      maxTotalTokens: creditResult.maxTotalTokens,
      onBudgetExceeded: (minimumTotalTokens) => fallbackTutorUsageToFree(user.id, parsed.data.requestId, {
        receiptId, executorId: creditResult.executorId, minimumTotalTokens,
      }),
    })
    const maintainMemory = () => Promise.allSettled([
      maybeUpdateTutorNotebook(user.id, { usageObserver: usageCollector.forPurpose('notebook_summary') }),
      maybeUpdateTutorConversationSummary(conversation.id, user.id, {
        usageObserver: usageCollector.forPurpose('conversation_summary'),
      }),
    ])
    timing.mark('profile_credit')

    const [studentProfile, scene, notebook] = await Promise.all([
      buildStudentProfile(supabase, user.id),
      buildTutorSceneContext(supabase, user.id, contextType, contextId, {
        stageIndex,
        lessonId,
        lessonStepIndex,
        scratchBlockTargetItemIndex,
        scratchEditorContext,
        surface,
        gameKey,
        // 资源候选由独立的模型规划器决定，避免每次对话加载全量课程目录或首页推荐。
        includeRecommendations: false,
      }),
      loadTutorNotebook(supabase, user.id),
    ])
    const sceneWithResources = scene
    timing.mark('profile_scene_notebook')
    const canUseSpeciesAudio = hasTutorSceneCapability(sceneWithResources.sceneCapabilities, 'speciesAudio')
    const effectiveSceneCapabilities = resolveTutorSceneCapabilities({
      serverCapabilities: sceneWithResources.sceneCapabilities,
      clientCapabilities: clientSceneCapabilities,
    })
    const scratchScreenshotDiagnosisEligible =
      contextType === 'course' &&
      typeof lessonId === 'number' &&
      hasTutorSceneCapability(effectiveSceneCapabilities, 'focusCourseLessonStep') &&
      shouldDiagnoseScratchScreenshot({
        content,
        images,
        items: sceneWithResources.scratchBlockItems ?? [],
      })
    const scratchScreenshotDiagnosisPromise = scratchScreenshotDiagnosisEligible
      ? diagnoseScratchScreenshot({ content, images, items: scene.scratchBlockItems ?? [],
          usageObserver: usageCollector.forPurpose('scratch_diagnosis') })
      : null
    const messageAudiosPromise = canUseSpeciesAudio
      ? findSpeciesAudiosForMessage(supabase, content)
      : Promise.resolve<TutorAudioRef[]>([])
    const [messageAudios, recentRows, previousHistory] = await Promise.all([
      messageAudiosPromise,
      supabase.from('tutor_messages').select('*').eq('conversation_id', conversation.id)
        .order('id', { ascending: false }).limit(CONTEXT_TURNS),
      loadPreviousContextHistory(supabase, user.id, contextType, contextId, parsed.data.previousContext),
    ])
    if (recentRows.error) throw recentRows.error
    timing.mark('message_audio')
    timing.mark('conversation_history')

    const history: TutorEngineMessage[] = ((recentRows.data ?? []) as TutorMessageRow[])
      .slice()
      .reverse()
      .map((row) => ({
        role: row.role as 'user' | 'assistant',
        content: row.role === 'assistant' ? sanitizeTutorReply(row.content) : row.content,
        images: row.images ?? undefined,
      }))

    history.push({
      role: 'user',
      content: content || '请看看我的产出。',
      images: images.length ? images : undefined,
    })

    const conversationText = history.map((message) => message.content).join('\n')
    const plannerHistory = ((recentRows.data ?? []) as TutorMessageRow[])
      .slice()
      .reverse()
      .slice(-6)
      .map(mapPlannerHistoryMessage)
    const normalizedScratchBlockTargetItemIndex = scene.scratchBlockTargetItemIndex
    const toolPlannerInput = {
      contextType,
      sceneCapabilities: effectiveSceneCapabilities,
      stageIndex,
      lessonId,
      lessonStepIndex,
      lessonStepCount,
      scratchBlockKeywords: sceneWithResources.scratchBlockKeywords,
      scratchBlockItems: sceneWithResources.scratchBlockItems,
      scratchBlockStepItemCount: sceneWithResources.scratchBlockStepItemCount,
      scratchBlockCategory: sceneWithResources.scratchBlockCategory,
      scratchBlockTargetItemIndex: normalizedScratchBlockTargetItemIndex,
      content,
    }
    const runToolPlanner = () =>
      planTutorToolDecision({ ...toolPlannerInput, previousMessages: plannerHistory,
        usageObserver: usageCollector.forPurpose('tool_planner') }).catch((error) => {
        logger.warn('Tutor tool planner failed.', {
          contextType,
          contextId,
          lessonId,
          lessonStepIndex,
          stageIndex,
          error: error instanceof Error ? error.message : String(error),
        })
        return null
      })
    // 没有截图诊断分支时，工具 planner 与资源 planner/物种提示并行，省一轮模型串行等待。
    const parallelToolPlannerPromise =
      !scratchScreenshotDiagnosisEligible && shouldPlanTutorToolDecision(toolPlannerInput)
        ? runToolPlanner()
        : Promise.resolve(null)
    const resourcePlanPromise = planTutorResourceSearch(content, {
      previousMessages: plannerHistory,
      hasImages: images.length > 0,
      hasCurrentLessonContext: contextType === 'course' && typeof lessonId === 'number',
      sceneSummary: scene.summary,
      usageObserver: usageCollector.forPurpose('resource_planner'),
    })
    const resourceSearchPromise = resourcePlanPromise.then((plan) =>
      plan.shouldSearch && !plan.clarification ? searchTutorResources(supabase, plan) : null,
    )
    const [resourcePlan, speciesHints, scratchScreenshotDiagnosis, parallelPlannerDecision, resourceSearch] = await Promise.all([
      resourcePlanPromise,
      canUseSpeciesAudio ? findSpeciesHintsForText(supabase, conversationText) : Promise.resolve([]),
      scratchScreenshotDiagnosisPromise ?? Promise.resolve(null),
      parallelToolPlannerPromise,
      resourceSearchPromise,
    ])
    const hintsSummary = buildSpeciesHintsSummary(speciesHints)
    timing.mark('species_hints')
    timing.mark('scratch_screenshot_diagnosis')
    timing.mark('resource_search')

    if (resourcePlan.clarification) {
      const clarification = resourcePlan.clarification
      const clarificationReply = clarification.prompt
      const clarificationMeta = buildConversationMeta({
        stageIndex,
        lessonId,
        lessonStepIndex,
        lessonStepCount,
        scratchBlockTargetItemIndex,
        surface,
        gameKey,
      })
      const assistantMeta: Record<string, unknown> = {
        ...clarificationMeta,
        clarification,
      }
      await maintainMemory()
      const usage = usageCollector.snapshot()
      if (usage.pendingCalls > 0) throw new Error('Tutor usage is not finalized')
      commitAttempted = true
      const saved = await completeTutorRequest(user.id, parsed.data.requestId, {
        content: content || '请看看我的产出。', images, meta: clarificationMeta,
        reply: clarificationReply, assistantMeta, usage, clarification: true, title: scene.title,
      })
      pendingRefund = null
      if (saved.status !== 'completed') return requestResultResponse(saved as Exclude<TutorRequestResult, { status: 'started' }>)
      timing.mark('persist_clarification')
      timing.log('clarification', {
        contextType,
        optionCount: clarification.options.length,
        replyLength: clarificationReply.length,
      })

      const encoder = new TextEncoder()
      const events: Record<string, unknown>[] = []
      if (TUTOR_TIMING_ENABLED) {
        events.push({ type: 'perf', phase: 'clarification', timings: timing.snapshot() })
      }
      events.push({ type: 'clarification', clarification })
      const clarificationBilling = parseTutorBilling((saved.message.meta as Record<string, unknown>).billing)
      events.push({ type: 'done', reply: clarificationReply, ...(clarificationBilling ? { billing: clarificationBilling } : {}) })
      const readable = new ReadableStream({
        start(controller) {
          for (const event of events) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
          }
          controller.close()
        },
      })
      const serverTiming = timing.serverTiming()
      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          ...(serverTiming ? { 'Server-Timing': serverTiming } : {}),
        },
      })
    }

    let toolCalls: TutorToolCall[] = scratchScreenshotDiagnosis
      ? buildTutorToolCallsFromPlan({
          contextType,
          sceneCapabilities: effectiveSceneCapabilities,
          lessonId,
          lessonStepIndex,
          lessonStepCount,
          scratchBlockKeywords: sceneWithResources.scratchBlockKeywords,
          scratchBlockItems: sceneWithResources.scratchBlockItems,
          scratchBlockStepItemCount: sceneWithResources.scratchBlockStepItemCount,
          scratchBlockCategory: sceneWithResources.scratchBlockCategory,
          scratchBlockTargetItemIndex: normalizedScratchBlockTargetItemIndex,
          selections: [
            {
              name: 'course.highlight_scratch_blocks',
              reason: 'review',
              targetItemIndex: scratchScreenshotDiagnosis.targetItemIndex,
            },
          ],
        })
      : (parallelPlannerDecision?.toolCalls ?? [])
    if (
      !scratchScreenshotDiagnosis &&
      scratchScreenshotDiagnosisEligible &&
      shouldPlanTutorToolDecision(toolPlannerInput)
    ) {
      // 诊断分支空手而归的少见情况：补跑一次 planner，保持原有兜底行为。
      const plannerDecision = await runToolPlanner()
      toolCalls = plannerDecision?.toolCalls ?? []
    }
    timing.mark('tool_planner')
    const focusLessonStepCall = toolCalls.find((toolCall) => toolCall.name === 'course.focus_lesson_step')
    const highlightScratchBlocksCall = toolCalls.find((toolCall) => toolCall.name === 'course.highlight_scratch_blocks')
    const promptLessonStepIndex =
      focusLessonStepCall?.name === 'course.focus_lesson_step'
        ? focusLessonStepCall.payload.stepIndex
        : lessonStepIndex
    const promptScratchBlockTargetItemIndex =
      highlightScratchBlocksCall?.name === 'course.highlight_scratch_blocks'
        ? highlightScratchBlocksCall.payload.targetItemIndex
        : promptLessonStepIndex === lessonStepIndex
          ? normalizedScratchBlockTargetItemIndex
          : undefined
    const promptScene =
      contextType === 'course' &&
      typeof lessonId === 'number' &&
      (promptLessonStepIndex !== lessonStepIndex ||
        promptScratchBlockTargetItemIndex !== scene.scratchBlockTargetItemIndex)
        ? await buildTutorSceneContext(supabase, user.id, contextType, contextId, {
            stageIndex,
            lessonId,
            lessonStepIndex: promptLessonStepIndex,
            scratchBlockTargetItemIndex: promptScratchBlockTargetItemIndex,
            scratchEditorContext,
            surface,
            gameKey,
            includeRecommendations: false,
          })
        : scene
    const resourceSummary = resourceSearch
      ? formatTutorResourceSearch(resourceSearch)
      : resourcePlan.status === 'fallback'
        ? '【本轮资源查询状态】检索规划暂时不可用，未完成站内检索。如需推荐实验或资源，必须说明这次查询暂时没成功；只能提供明确标为通用建议的内容，不得声称没有匹配项目或编造站内入口。'
        : ''
    timing.mark('prompt_scene')
    const replyFocusSummary = buildTutorReplyFocusSummary({
      toolCalls,
      previousLessonStepIndex: lessonStepIndex,
    })
    const canUsePromptSpeciesAudio = hasTutorSceneCapability(promptScene.sceneCapabilities, 'speciesAudio')
    const availableAudios = canUsePromptSpeciesAudio
      ? mergeTutorAudios(
          promptScene.availableAudios ?? [],
          messageAudios,
          speciesHintsToAudioRefs(speciesHints),
        )
      : []

    const systemPrompt = buildTutorSystemPrompt({
      scene: promptScene,
      profile: studentProfile,
      notebook,
      // 会话滚动摘要：前轮结算前维护的已保存消息，本轮新消息在后续请求中纳入。
      conversationSummary: conversation.summary,
      resourceSummary,
      replyFocusSummary,
      speciesHintsSummary: hintsSummary,
    })
    const referenceSources = [promptScene.summary, resourceSummary, studentProfile.text]
    const engineHistory = trimHistoryToCharBudget([...previousHistory, ...history])
    timing.mark('build_prompt')
    const earlyAudioPlanPromise =
      canUsePromptSpeciesAudio && availableAudios.length > 0
        ? planTutorAudioAttachment(content, '', availableAudios, { usageObserver: usageCollector.forPurpose('audio_planner') })
        : Promise.resolve<TutorAudioRef | null>(null)

    const encoder = new TextEncoder()
    let fullReply = ''
    // 客户端中途断开（关面板/刷新）后 enqueue 会抛错；用标记保证后续落库照常进行。
    let cancelled = false
    const speechRef: { current: ReturnType<typeof createTutorSpeechStreamer> | null } = { current: null }
    let speechCompletion: Promise<boolean> | null = null

    const readable = new ReadableStream({
      cancel() {
        cancelled = true
        speechRef.current?.abort()
      },
      async start(controller) {
        const safeEnqueue = (payload: Record<string, unknown>) => {
          if (cancelled) return
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
          } catch {
            cancelled = true
          }
        }
        const safeClose = () => {
          if (cancelled) return
          try {
            controller.close()
          } catch {
            // already closed
          }
        }

        let telemetry: TutorEngineTelemetry | null = null
        let replySaved = false
        let billing: TutorBilling | undefined

        try {
          try {
            if (TUTOR_TIMING_ENABLED) {
              safeEnqueue({ type: 'perf', phase: 'server_ready', timings: timing.snapshot() })
            }
            if (wantSpeak) {
              const voiceAccess = await getTutorVoiceAccess(supabase, user).catch(() => null)
              if (voiceAccess) {
              speechRef.current = createTutorSpeechStreamer(user.id, {
                voice: voiceAccess.voice,
                signal: request.signal,
                onAudio: (pcm, sampleRate) => {
                  safeEnqueue({ type: 'audio', pcm, sampleRate, voice: voiceAccess.voice })
                },
                onError: (error) => {
                  safeEnqueue({ type: 'audio_error', error: error.userMessage })
                  logger.warn('Tutor realtime TTS failed', { message: error.message })
                },
              })
              // push() starts TTS lazily after a sanitized reply is available.
              }
            }
            for (const toolCall of toolCalls) {
              safeEnqueue({ type: 'tool_call', toolCall })
            }

            const stream = streamChatWithTutor(systemPrompt, engineHistory, {
              maxTokens: creditResult.maxOutputTokens,
              usageObserver: usageCollector.forPurpose('main_reply'),
              onVisionFallback: () => {
                safeEnqueue({
                  type: 'warning',
                  warning: '这次图片没能识别成功，小迪先根据文字回复。',
                })
              },
              onTelemetry: (value) => {
                telemetry = value
              },
            })
            let sawFirstAiChunk = false
            while (true) {
              const { value, done } = await stream.next()
              if (done) {
                fullReply = typeof value === 'string' ? validateTutorResourceTags(value, referenceSources) : fullReply
                break
              }
              if (value) {
                if (!sawFirstAiChunk) {
                  sawFirstAiChunk = true
                  timing.mark('first_ai_chunk')
                  if (TUTOR_TIMING_ENABLED) {
                    safeEnqueue({ type: 'perf', phase: 'first_ai_chunk', timings: timing.snapshot() })
                  }
                }
                // The engine delivers the fully buffered, reasoning-cleaned reply; validate references before any output sink.
                const safeContent = validateTutorResourceTags(value, referenceSources)
                fullReply += safeContent
                safeEnqueue({ type: 'chunk', content: safeContent })
                speechRef.current?.push(safeContent)
              }
            }
            // Close TTS input immediately; do not wait for memory, settlement or persistence.
            // Observe rejection now so a fast audio failure cannot become unhandled.
            speechCompletion = speechRef.current?.finish().catch(() => false) ?? null
            timing.mark('ai_stream_done')
          } catch (error) {
            speechRef.current?.abort()
            speechRef.current = null
            await release()
            timing.log('stream_error', {
              contextType,
              hasImages: images.length > 0,
              hasToolCalls: toolCalls.length > 0,
              error: error instanceof Error ? error.message : String(error),
            })
            safeEnqueue({ type: 'error', error: getTutorEngineUserMessage(error), requestState: confirmedFailed ? 'failed' : 'processing' })
            safeClose()
            return
          }

          if (!fullReply.trim()) {
            speechRef.current?.abort()
            speechRef.current = null
            await release()
            safeEnqueue({ type: 'error', error: '小迪没有给出内容，请换个说法再试。', requestState: confirmedFailed ? 'failed' : 'processing' })
            safeClose()
            return
          }

          const replyAudios = canUsePromptSpeciesAudio
            ? await findSpeciesAudiosMentionedInText(supabase, `${content}\n${fullReply}`)
            : []
          const availableAudioSlugs = new Set(availableAudios.map((audio) => audio.slug))
          const hasNewReplyAudios = replyAudios.some((audio) => !availableAudioSlugs.has(audio.slug))
          // The early planner also consumed work when a later result replaces
          // its choice. Wait for both so no request usage arrives after billing.
          const earlyAudioPlan = await earlyAudioPlanPromise
          const selectedAudio = canUsePromptSpeciesAudio
            ? hasNewReplyAudios
              ? await planTutorAudioAttachment(
                  content,
                  fullReply,
                  mergeTutorAudios(availableAudios, replyAudios),
                  { usageObserver: usageCollector.forPurpose('audio_planner') },
                )
              : earlyAudioPlan
            : null
          fullReply = finalizeReplyAudio(fullReply, selectedAudio)
          timing.mark('finalize_audio')

          // meta 全部由服务端生成，不接受客户端直通字段
          const meta: Record<string, unknown> = {}
          if (typeof stageIndex === 'number') meta.stageIndex = stageIndex
          if (typeof lessonId === 'number') meta.lessonId = lessonId
          if (typeof lessonStepIndex === 'number') meta.lessonStepIndex = lessonStepIndex
          if (typeof lessonStepCount === 'number') meta.lessonStepCount = lessonStepCount
          if (typeof scratchBlockTargetItemIndex === 'number') {
            meta.scratchBlockTargetItemIndex = scratchBlockTargetItemIndex
          }

          // Public messages keep only reply metadata. Raw per-call usage is
          // stored by the settlement transaction in a service-only record.
          const assistantMeta: Record<string, unknown> = { ...meta }
          const finalTelemetry = telemetry as TutorEngineTelemetry | null
          assistantMeta.ai = {
            promptVersion: TUTOR_PROMPT_VERSION,
            creditReceiptId: receiptId,
            ...(finalTelemetry
              ? {
                  model: finalTelemetry.model,
                  visionFallback: finalTelemetry.visionFallback,
                }
              : {}),
          }

          // Fold previously saved messages before settlement, so this request
          // owns all of its model work. Newly saved messages enter a later fold.
          await maintainMemory()
          const usage = usageCollector.snapshot()
          if (usage.pendingCalls > 0) throw new Error('Tutor usage is not finalized')
          commitAttempted = true
          const saved = await completeTutorRequest(user.id, parsed.data.requestId, {
            content: content || '请看看我的产出。', images, meta, reply: fullReply, assistantMeta,
            usage,
            title: scene.title,
          })
          if (saved.status !== 'completed') {
            confirmedFailed = saved.status === 'failed'
            throw new Error('Tutor request was not completed')
          }
          replySaved = true
          billing = parseTutorBilling((saved.message.meta as Record<string, unknown>).billing) ?? undefined
          if (usage.usageMissing && billing?.source === 'wallet') {
            safeEnqueue({ type: 'warning', warning: usage.totalTokens > 0
              ? '本次部分服务用量未能确认，只收取已确认部分的代币。'
              : '本次费用未能准确核实，未收取代币。' })
          }
          timing.mark('persist_messages')
          timing.log('done', {
            contextType,
            hasImages: images.length > 0,
            hasToolCalls: toolCalls.length > 0,
            replyLength: fullReply.length,
          })

          if ((telemetry as TutorEngineTelemetry | null)?.finishReason === 'length') {
            safeEnqueue({ type: 'warning', warning: '本次回答已达到输出上限，可以继续提问。' })
          }
          safeEnqueue({ type: 'done', reply: fullReply, ...(billing ? { billing } : {}) })
          if (speechCompletion) {
            let complete = false
            try {
              complete = await speechCompletion
            } catch {
              // TTS 失败只静音，文字已经发出
            }
            safeEnqueue({ type: 'audio_done', complete })
          }
        } catch (error) {
          speechRef.current?.abort()
          logger.warn('Tutor reply finalization failed.', { receiptId, error: String(error) })
          if (replySaved) {
            safeEnqueue({ type: 'warning', warning: '回复已保存，后续处理暂未完成。' })
            safeEnqueue({ type: 'done', reply: fullReply, ...(billing ? { billing } : {}) })
          } else {
            if (!commitAttempted) await release()
            safeEnqueue({ type: 'error', error: commitAttempted && !confirmedFailed ? '回复保存状态暂未确认，请重试以恢复结果。' : '回复处理失败，请稍后再试。', requestState: confirmedFailed ? 'failed' : 'processing' })
          }
        } finally {
          safeClose()
        }
      },
    })

    const serverTiming = timing.serverTiming()
    // 流内部有独立的退款路径；移交给流之后，外层 catch 不再负责退款。
    pendingRefund = null
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        ...(serverTiming ? { 'Server-Timing': serverTiming } : {}),
      },
    })
  } catch (error) {
    if (pendingRefund && !commitAttempted) {
      await pendingRefund().catch(() => undefined)
    }
    timing.log('request_error', {
      error: error instanceof Error ? error.message : String(error),
    })
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    const response = handleApiError(error)
    const payload = await response.json()
    return NextResponse.json({ ...payload, requestState: confirmedFailed ? 'failed' : 'processing' }, { status: response.status })
  }
}
