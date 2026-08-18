import { after, NextRequest, NextResponse } from 'next/server'

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
import { consumeAiCredit, getAiCreditStatusForProfile, refundAiCredit } from '@/lib/api/ai-credits'
import { handleApiError, requireAuth } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import {
  ValidationError,
  validateContentSafeIfPresent,
  validateOwnedOrTrustedImageUrlFromSources,
} from '@/lib/api/validation'
import {
  AI_CREDIT_COST_TEXT,
  AI_TUTOR_RATE_LIMIT_PER_MINUTE,
  getAiChatCreditCost,
  getMembershipSummary,
} from '@/lib/membership'
import { TutorSendSchema } from '@/lib/schemas'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import { createTutorSpeechStreamer } from '@/lib/ai/tutor/speech'

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
type TutorConversationRow = Database['public']['Tables']['tutor_conversations']['Row']

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
    content: row.content,
    images: row.images ?? undefined,
    stageIndex: typeof meta.stageIndex === 'number' ? meta.stageIndex : undefined,
    ...(clarification ? { clarification } : {}),
  }
}

function mapPlannerHistoryMessage(row: TutorMessageRow) {
  const meta = (row.meta ?? {}) as Record<string, unknown>
  const clarification = normalizeTutorResourceClarification(meta.clarification)
  const content = clarification
    ? [
        row.content,
        `【小迪上一轮给出的选项】${clarification.options.map((option) => option.label).join(' / ')}`,
      ].filter(Boolean).join('\n')
    : row.content

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

async function getActiveConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  contextType: TutorContextType,
  contextId: string,
) {
  const { data, error } = await supabase
    .from('tutor_conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('context_type', contextType)
    .eq('context_id', contextId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as TutorConversationRow | null
}

async function createConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    userId: string
    contextType: TutorContextType
    contextId: string
    title: string
    meta: Record<string, unknown>
  },
) {
  const { data, error } = await supabase
    .from('tutor_conversations')
    .insert({
      user_id: input.userId,
      context_type: input.contextType,
      context_id: input.contextId,
      title: input.title || '小迪对话',
      meta: input.meta,
    } as never)
    .select('*')
    .single()

  if (error) throw error
  return data as TutorConversationRow
}

async function getOrCreateActiveConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    userId: string
    contextType: TutorContextType
    contextId: string
    title: string
    meta: Record<string, unknown>
  },
) {
  const active = await getActiveConversation(supabase, input.userId, input.contextType, input.contextId)
  if (active) return active

  try {
    return await createConversation(supabase, input)
  } catch (error) {
    // 并发打开同一场景时，唯一索引可能已经创建 active 线程；重查即可。
    const activeAfterRace = await getActiveConversation(supabase, input.userId, input.contextType, input.contextId)
    if (activeAfterRace) return activeAfterRace
    throw error
  }
}

/**
 * 归档当前 active 线程；空线程直接保留复用，避免反复点「开启新对话」
 * 在历史里堆出一堆空的归档线程。新线程由下一条 POST 惰性创建。
 */
async function archiveActiveConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  contextType: TutorContextType,
  contextId: string,
) {
  const active = await getActiveConversation(supabase, userId, contextType, contextId)
  if (!active) return

  const { count, error: countError } = await supabase
    .from('tutor_messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', active.id)
  if (countError) throw countError
  if ((count ?? 0) === 0) return

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('tutor_conversations')
    .update({
      status: 'archived',
      archived_at: now,
      updated_at: now,
    } as never)
    .eq('id', active.id)
    .eq('user_id', userId)
    .eq('status', 'active')

  if (error) throw error
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

    const [quota, studentProfile, scene, notebook] = await Promise.all([
      getAiCreditStatusForProfile(supabase, profile),
      buildStudentProfile(supabase, user.id),
      buildTutorSceneContext(supabase, user.id, contextType, contextId, { stageIndex, lessonId, surface, gameKey }),
      loadTutorNotebook(supabase, user.id),
    ])
    // 只读：不在 GET 里创建会话，避免“打开面板就落一条空线程”；首条消息由 POST 创建。
    const conversation = await getActiveConversation(supabase, user.id, contextType, contextId)
    const messages = conversation ? await loadHistory(supabase, conversation.id) : []

    const greeting = messages.length === 0 ? buildTutorGreeting(studentProfile, scene) : null

    return NextResponse.json({
      messages,
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
    await archiveActiveConversation(supabase, user.id, contextType, contextId)

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const timing = createTutorTimingTrace('api/tutor/chat POST')
  // 扣费成功后、流式响应移交前若抛错，由外层 catch 统一退款
  let pendingRefund: (() => Promise<void>) | null = null

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
        { error: parsed.error.issues.map((issue) => issue.message).join(', ') },
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
    const cost = getAiChatCreditCost(images.length > 0)

    validateContentSafeIfPresent(content, '对话内容')
    for (const image of images) {
      validateOwnedOrTrustedImageUrlFromSources(image, user.id, '产出图片', TUTOR_IMAGE_SOURCES)
    }
    timing.mark('parse_validate')

    const { data: profile } = await supabase
      .from('profiles')
      .select('membership_tier, membership_period, membership_started_at, membership_expires_at')
      .eq('id', user.id)
      .maybeSingle()

    const creditResult = await consumeAiCredit(supabase, profile, cost)
    if (!creditResult.ok) {
      const membership = getMembershipSummary(profile)
      return NextResponse.json(
        {
          error: '今日免费次数或本月代币已用完',
          code: 'quota_exceeded',
          resetAt: creditResult.resetAt,
          membership,
        },
        { status: 402 },
      )
    }
    timing.mark('profile_credit')

    // 所有失败路径共用同一份退款额度：refund 按剩余可退金额封顶，天然防止重复退款。
    let remainingCharge = creditResult.source ? cost : 0
    const refund = async (amount: number) => {
      if (!creditResult.source) return
      const value = Math.min(amount, remainingCharge)
      if (value <= 0) return
      remainingCharge -= value
      await refundAiCredit(supabase, value, creditResult.source).catch((error) => {
        logger.warn('AI credit refund failed.', {
          amount: value,
          source: creditResult.source,
          error: error instanceof Error ? error.message : String(error),
        })
      })
    }
    pendingRefund = () => refund(cost)

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
      ? diagnoseScratchScreenshot({ content, images, items: scene.scratchBlockItems ?? [] })
      : null
    const messageAudiosPromise = canUseSpeciesAudio
      ? findSpeciesAudiosForMessage(supabase, content)
      : Promise.resolve<TutorAudioRef[]>([])
    const conversationPromise = getOrCreateActiveConversation(supabase, {
      userId: user.id,
      contextType,
      contextId,
      title: scene.title,
      meta: buildConversationMeta({
        stageIndex,
        lessonId,
        lessonStepIndex,
        lessonStepCount,
        scratchBlockTargetItemIndex,
        surface,
        gameKey,
      }),
    })
    const historyRowsPromise = conversationPromise.then(async (activeConversation) => {
      const recentRows = await supabase
        .from('tutor_messages')
        .select('*')
        .eq('conversation_id', activeConversation.id)
        .order('id', { ascending: false })
        .limit(CONTEXT_TURNS)

      if (recentRows.error) throw recentRows.error
      return recentRows
    })
    const [messageAudios, conversation, recentRows] = await Promise.all([
      messageAudiosPromise,
      conversationPromise,
      historyRowsPromise,
    ])
    timing.mark('message_audio')
    timing.mark('conversation_history')

    const history: TutorEngineMessage[] = ((recentRows.data ?? []) as TutorMessageRow[])
      .slice()
      .reverse()
      .map((row) => ({
        role: row.role as 'user' | 'assistant',
        content: row.content,
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
      planTutorToolDecision({ ...toolPlannerInput, previousMessages: plannerHistory }).catch((error) => {
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
      const { error: insertError } = await supabase.from('tutor_messages').insert([
        {
          conversation_id: conversation.id,
          user_id: user.id,
          context_type: contextType,
          context_id: contextId,
          role: 'user',
          content: content || '请看看我的产出。',
          images: images.length ? images : null,
          meta: clarificationMeta,
        },
        {
          conversation_id: conversation.id,
          user_id: user.id,
          context_type: contextType,
          context_id: contextId,
          role: 'assistant',
          content: clarificationReply,
          images: null,
          meta: assistantMeta,
        },
      ] as never)

      let warning: string | null = null
      if (insertError) {
        warning = '这次澄清没有保存到历史记录。'
      } else {
        const { error: updateConversationError } = await supabase
          .from('tutor_conversations')
          .update({ updated_at: new Date().toISOString() } as never)
          .eq('id', conversation.id)
          .eq('user_id', user.id)
        if (updateConversationError) warning = '对话时间未能更新，但澄清问题已保存。'
        after(async () => {
          await Promise.all([
            maybeUpdateTutorNotebook(user.id),
            maybeUpdateTutorConversationSummary(conversation.id, user.id),
          ])
        })
      }

      // 澄清本身不算一次完整 AI 对话；选项被确认后再为真正的检索回答计费。
      await refund(cost)
      pendingRefund = null
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
      if (warning) events.push({ type: 'warning', warning })
      events.push({ type: 'done', reply: clarificationReply })
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
    const promptSceneWithResources = resourceSearch
      ? { ...promptScene, summary: [formatTutorResourceSearch(resourceSearch), promptScene.summary].filter(Boolean).join('\n\n') }
      : promptScene
    timing.mark('prompt_scene')
    const replyFocusSummary = buildTutorReplyFocusSummary({
      toolCalls,
      previousLessonStepIndex: lessonStepIndex,
    })
    const sceneForPrompt = replyFocusSummary || hintsSummary
      ? { ...promptSceneWithResources, summary: [replyFocusSummary, promptSceneWithResources.summary, hintsSummary].filter(Boolean).join('\n\n') }
      : promptSceneWithResources
    const canUsePromptSpeciesAudio = hasTutorSceneCapability(promptSceneWithResources.sceneCapabilities, 'speciesAudio')
    const availableAudios = canUsePromptSpeciesAudio
      ? mergeTutorAudios(
          promptScene.availableAudios ?? [],
          messageAudios,
          speciesHintsToAudioRefs(speciesHints),
        )
      : []

    const systemPrompt = buildTutorSystemPrompt({
      scene: sceneForPrompt,
      profile: studentProfile,
      notebook,
      // 会话滚动摘要：窗口外的早期对话内容（由 after() 里的后台任务滚动维护）
      conversationSummary: conversation.summary,
    })
    const engineHistory = trimHistoryToCharBudget(history)
    timing.mark('build_prompt')
    const earlyAudioPlanPromise =
      canUsePromptSpeciesAudio && availableAudios.length > 0
        ? planTutorAudioAttachment(content, '', availableAudios)
        : Promise.resolve<TutorAudioRef | null>(null)

    const encoder = new TextEncoder()
    let fullReply = ''
    // 客户端中途断开（关面板/刷新）后 enqueue 会抛错；用标记保证后续落库照常进行。
    let cancelled = false
    const speechRef: { current: ReturnType<typeof createTutorSpeechStreamer> | null } = { current: null }

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

        let visionFallback = false
        let telemetry: TutorEngineTelemetry | null = null

        try {
          if (TUTOR_TIMING_ENABLED) {
            safeEnqueue({ type: 'perf', phase: 'server_ready', timings: timing.snapshot() })
          }
          if (wantSpeak) {
            speechRef.current = createTutorSpeechStreamer({
              onAudio: (pcm, sampleRate) => {
                safeEnqueue({ type: 'audio', pcm, sampleRate })
              },
              onError: (error) => {
                logger.warn('Tutor realtime TTS failed', { message: error.message })
              },
            })
            speechRef.current.start()
          }
          for (const toolCall of toolCalls) {
            safeEnqueue({ type: 'tool_call', toolCall })
          }

          const stream = streamChatWithTutor(systemPrompt, engineHistory, {
            onVisionFallback: () => {
              visionFallback = true
              safeEnqueue({
                type: 'warning',
                warning: '这次图片没能识别成功，小迪先按文字回复，图片分析的差价会退回。',
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
              fullReply = typeof value === 'string' ? value : fullReply
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
              fullReply += value
              safeEnqueue({ type: 'chunk', content: value })
              speechRef.current?.push(value)
            }
          }
          timing.mark('ai_stream_done')
        } catch (error) {
          speechRef.current?.abort()
          speechRef.current = null
          await refund(cost)
          timing.log('stream_error', {
            contextType,
            hasImages: images.length > 0,
            hasToolCalls: toolCalls.length > 0,
            error: error instanceof Error ? error.message : String(error),
          })
          safeEnqueue({ type: 'error', error: getTutorEngineUserMessage(error) })
          safeClose()
          return
        }

        if (!fullReply.trim()) {
          speechRef.current?.abort()
          speechRef.current = null
          await refund(cost)
          safeEnqueue({ type: 'error', error: '小迪没有给出内容，请换个说法再试。' })
          safeClose()
          return
        }

        // 图片识别降级为纯文本：只收文字对话的价，退回视觉分析差价。
        if (visionFallback) {
          await refund(cost - AI_CREDIT_COST_TEXT)
        }

        const replyAudios = canUsePromptSpeciesAudio
          ? await findSpeciesAudiosMentionedInText(supabase, `${content}\n${fullReply}`)
          : []
        const availableAudioSlugs = new Set(availableAudios.map((audio) => audio.slug))
        const hasNewReplyAudios = replyAudios.some((audio) => !availableAudioSlugs.has(audio.slug))
        const selectedAudio = canUsePromptSpeciesAudio
          ? hasNewReplyAudios
            ? await planTutorAudioAttachment(
                content,
                fullReply,
                mergeTutorAudios(availableAudios, replyAudios),
              )
            : await earlyAudioPlanPromise
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

        // 模型、token 用量与 prompt 版本只挂在助手消息上，供成本核对与提示词回归定位。
        const assistantMeta: Record<string, unknown> = { ...meta }
        const finalTelemetry = telemetry as TutorEngineTelemetry | null
        assistantMeta.ai = {
          promptVersion: TUTOR_PROMPT_VERSION,
          ...(finalTelemetry
            ? {
                model: finalTelemetry.model,
                visionFallback: finalTelemetry.visionFallback,
                ...(finalTelemetry.usage ? { usage: finalTelemetry.usage } : {}),
              }
            : {}),
        }

        const { error: insertError } = await supabase.from('tutor_messages').insert([
          {
            conversation_id: conversation.id,
            user_id: user.id,
            context_type: contextType,
            context_id: contextId,
            role: 'user',
            content: content || '请看看我的产出。',
            images: images.length ? images : null,
            meta,
          },
          {
            conversation_id: conversation.id,
            user_id: user.id,
            context_type: contextType,
            context_id: contextId,
            role: 'assistant',
            content: fullReply,
            images: null,
            meta: assistantMeta,
          },
        ] as never)

        if (insertError) {
          // 回复已生成并展示，不作废内容：退还代币、提示未保存，照常结束。
          await refund(cost)
          safeEnqueue({ type: 'warning', warning: '本条回复未能保存到历史记录。' })
        } else {
          const { error: updateConversationError } = await supabase
            .from('tutor_conversations')
            .update({ updated_at: new Date().toISOString() } as never)
            .eq('id', conversation.id)
            .eq('user_id', user.id)
          if (updateConversationError) {
            safeEnqueue({ type: 'warning', warning: '对话时间未能更新，但消息已保存。' })
          }
          after(async () => {
            // 两层记忆：用户级 notebook + 会话级滚动摘要，都在响应后台更新
            await Promise.all([
              maybeUpdateTutorNotebook(user.id),
              maybeUpdateTutorConversationSummary(conversation.id, user.id),
            ])
          })
        }
        timing.mark('persist_messages')
        timing.log('done', {
          contextType,
          hasImages: images.length > 0,
          hasToolCalls: toolCalls.length > 0,
          replyLength: fullReply.length,
        })

        safeEnqueue({ type: 'done', reply: fullReply })
        if (speechRef.current) {
          try {
            await speechRef.current.finish()
          } catch {
            // TTS 失败只静音，文字已经发出
          }
          safeEnqueue({ type: 'audio_done' })
        }
        safeClose()
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
    if (pendingRefund) {
      await pendingRefund().catch(() => undefined)
    }
    timing.log('request_error', {
      error: error instanceof Error ? error.message : String(error),
    })
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return handleApiError(error)
  }
}
