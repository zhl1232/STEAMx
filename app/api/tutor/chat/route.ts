import { after, NextRequest, NextResponse } from 'next/server'

import { buildTutorSceneContext } from '@/lib/ai/tutor/context-builders'
import {
  finalizeReplyAudio,
  findSpeciesAudiosForMessage,
  findSpeciesAudiosMentionedInText,
  type TutorAudioRef,
} from '@/lib/ai/tutor/audio-tags'
import {
  buildSpeciesHintsSummary,
  findSpeciesHintsForText,
  speciesHintsToAudioRefs,
} from '@/lib/ai/tutor/species-hints'
import { streamChatWithTutor, getTutorEngineUserMessage, type TutorEngineMessage } from '@/lib/ai/tutor/engine'
import { buildTutorGreeting } from '@/lib/ai/tutor/greeting'
import { maybeUpdateTutorNotebook, loadTutorNotebook } from '@/lib/ai/tutor/memory'
import { planTutorToolDecision, shouldPlanTutorToolDecision } from '@/lib/ai/tutor/tool-call-planner'
import { buildTutorSystemPrompt } from '@/lib/ai/tutor/prompt'
import { buildTutorReplyFocusSummary } from '@/lib/ai/tutor/reply-focus'
import { diagnoseScratchScreenshot, shouldDiagnoseScratchScreenshot } from '@/lib/ai/tutor/scratch-screenshot-diagnosis'
import { hasTutorSceneCapability, resolveTutorSceneCapabilities } from '@/lib/ai/tutor/scene-capabilities'
import { buildStudentProfile } from '@/lib/ai/tutor/student-profile'
import type { TutorToolCall } from '@/lib/ai/tutor/tool-calls'
import { buildTutorToolCallsFromPlan } from '@/lib/ai/tutor/tool-registry'
import { TUTOR_GLOBAL_SURFACES, type TutorContextType, type TutorGlobalSurface } from '@/lib/ai/tutor/types'
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
  AI_TUTOR_RATE_LIMIT_PER_MINUTE,
  getAiChatCreditCost,
  getMembershipSummary,
} from '@/lib/membership'
import { TutorSendSchema } from '@/lib/schemas'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

const HISTORY_LIMIT = 200
const CONTEXT_TURNS = 12
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
  const contextType = (searchParams.get('contextType') || 'global') as TutorContextType
  const contextId = searchParams.get('contextId') || ''
  const stageIndexRaw = searchParams.get('stageIndex')
  const stageIndex = stageIndexRaw != null ? Number.parseInt(stageIndexRaw, 10) : undefined
  const lessonIdRaw = searchParams.get('lessonId')
  const lessonId = lessonIdRaw != null ? Number.parseInt(lessonIdRaw, 10) : undefined
  const surfaceRaw = searchParams.get('surface')
  const surface = TUTOR_GLOBAL_SURFACES.includes(surfaceRaw as TutorGlobalSurface)
    ? (surfaceRaw as TutorGlobalSurface)
    : undefined
  return {
    contextType,
    contextId,
    stageIndex: Number.isNaN(stageIndex ?? NaN) ? undefined : stageIndex,
    lessonId: Number.isNaN(lessonId ?? NaN) ? undefined : lessonId,
    surface,
  }
}

function mapMessage(row: TutorMessageRow) {
  const meta = (row.meta ?? {}) as Record<string, unknown>
  return {
    role: row.role as 'user' | 'assistant',
    content: row.content,
    images: row.images ?? undefined,
    stageIndex: typeof meta.stageIndex === 'number' ? meta.stageIndex : undefined,
  }
}

function buildConversationMeta(input: {
  stageIndex?: number
  lessonId?: number
  lessonStepIndex?: number
  lessonStepCount?: number
  scratchBlockTargetItemIndex?: number
  surface?: TutorGlobalSurface
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

async function startNewConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    userId: string
    contextType: TutorContextType
    contextId: string
    title: string
    meta: Record<string, unknown>
  },
) {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('tutor_conversations')
    .update({
      status: 'archived',
      archived_at: now,
      updated_at: now,
    } as never)
    .eq('user_id', input.userId)
    .eq('context_type', input.contextType)
    .eq('context_id', input.contextId)
    .eq('status', 'active')

  if (error) throw error
  return createConversation(supabase, input)
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

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    const { contextType, contextId, stageIndex, lessonId, surface } = parseContextParams(request.nextUrl.searchParams)

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
      buildTutorSceneContext(supabase, user.id, contextType, contextId, { stageIndex, lessonId, surface }),
      loadTutorNotebook(supabase, user.id),
    ])
    const conversation = await getOrCreateActiveConversation(supabase, {
      userId: user.id,
      contextType,
      contextId,
      title: scene.title,
      meta: buildConversationMeta({ stageIndex, lessonId, surface }),
    })
    const messages = await loadHistory(supabase, conversation.id)

    const greeting = messages.length === 0 ? buildTutorGreeting(studentProfile, scene) : null

    return NextResponse.json({
      messages,
      quota,
      greeting,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.created_at,
      },
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
    const { contextType, contextId, stageIndex, lessonId, surface } = parseContextParams(request.nextUrl.searchParams)
    const scene = await buildTutorSceneContext(supabase, user.id, contextType, contextId, { stageIndex, lessonId, surface })
    const conversation = await startNewConversation(supabase, {
      userId: user.id,
      contextType,
      contextId,
      title: scene.title,
      meta: buildConversationMeta({ stageIndex, lessonId, surface }),
    })

    return NextResponse.json({ ok: true, conversation: { id: conversation.id } })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const timing = createTutorTimingTrace('api/tutor/chat POST')

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

    const [studentProfile, scene, notebook] = await Promise.all([
      buildStudentProfile(supabase, user.id),
      buildTutorSceneContext(supabase, user.id, contextType, contextId, {
        stageIndex,
        lessonId,
        lessonStepIndex,
        scratchBlockTargetItemIndex,
        scratchEditorContext,
        surface,
        includeRecommendations: true,
      }),
      loadTutorNotebook(supabase, user.id),
    ])
    timing.mark('profile_scene_notebook')
    const canUseSpeciesAudio = hasTutorSceneCapability(scene.sceneCapabilities, 'speciesAudio')
    const effectiveSceneCapabilities = resolveTutorSceneCapabilities({
      serverCapabilities: scene.sceneCapabilities,
      clientCapabilities: clientSceneCapabilities,
    })
    const scratchScreenshotDiagnosisEligible =
      contextType === 'course' &&
      typeof lessonId === 'number' &&
      hasTutorSceneCapability(effectiveSceneCapabilities, 'focusCourseLessonStep') &&
      shouldDiagnoseScratchScreenshot({
        content,
        images,
        items: scene.scratchBlockItems ?? [],
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
      }),
    })
    const [messageAudios, conversation] = await Promise.all([messageAudiosPromise, conversationPromise])
    timing.mark('message_audio')
    const recentRows = await supabase
      .from('tutor_messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('id', { ascending: false })
      .limit(CONTEXT_TURNS)

    if (recentRows.error) throw recentRows.error
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
    const [speciesHints, scratchScreenshotDiagnosis] = await Promise.all([
      canUseSpeciesAudio ? findSpeciesHintsForText(supabase, conversationText) : Promise.resolve([]),
      scratchScreenshotDiagnosisPromise ?? Promise.resolve(null),
    ])
    const hintsSummary = buildSpeciesHintsSummary(speciesHints)
    timing.mark('species_hints')
    timing.mark('scratch_screenshot_diagnosis')
    const normalizedScratchBlockTargetItemIndex = scene.scratchBlockTargetItemIndex
    let toolCalls: TutorToolCall[] = scratchScreenshotDiagnosis
      ? buildTutorToolCallsFromPlan({
          contextType,
          sceneCapabilities: effectiveSceneCapabilities,
          lessonId,
          lessonStepIndex,
          lessonStepCount,
          scratchBlockKeywords: scene.scratchBlockKeywords,
          scratchBlockItems: scene.scratchBlockItems,
          scratchBlockStepItemCount: scene.scratchBlockStepItemCount,
          scratchBlockCategory: scene.scratchBlockCategory,
          scratchBlockTargetItemIndex: normalizedScratchBlockTargetItemIndex,
          selections: [
            {
              name: 'course.highlight_scratch_blocks',
              reason: 'review',
              targetItemIndex: scratchScreenshotDiagnosis.targetItemIndex,
            },
          ],
        })
      : []
    if (
      !scratchScreenshotDiagnosisEligible &&
      shouldPlanTutorToolDecision({
        contextType,
        sceneCapabilities: effectiveSceneCapabilities,
        stageIndex,
        lessonId,
        lessonStepIndex,
        lessonStepCount,
        scratchBlockKeywords: scene.scratchBlockKeywords,
        scratchBlockItems: scene.scratchBlockItems,
        scratchBlockStepItemCount: scene.scratchBlockStepItemCount,
        scratchBlockCategory: scene.scratchBlockCategory,
        scratchBlockTargetItemIndex: normalizedScratchBlockTargetItemIndex,
        content,
      })
    ) {
      try {
        const plannerDecision = await planTutorToolDecision({
          contextType,
          sceneCapabilities: effectiveSceneCapabilities,
          stageIndex,
          lessonId,
          lessonStepIndex,
          lessonStepCount,
          scratchBlockKeywords: scene.scratchBlockKeywords,
          scratchBlockItems: scene.scratchBlockItems,
          scratchBlockStepItemCount: scene.scratchBlockStepItemCount,
          scratchBlockCategory: scene.scratchBlockCategory,
          scratchBlockTargetItemIndex: normalizedScratchBlockTargetItemIndex,
          content,
        })
        toolCalls = plannerDecision?.toolCalls ?? []
      } catch (error) {
        logger.warn('Tutor tool planner failed.', {
          contextType,
          contextId,
          lessonId,
          lessonStepIndex,
          stageIndex,
          error: error instanceof Error ? error.message : String(error),
        })
      }
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
            includeRecommendations: true,
          })
        : scene
    timing.mark('prompt_scene')
    const replyFocusSummary = buildTutorReplyFocusSummary({
      toolCalls,
      previousLessonStepIndex: lessonStepIndex,
    })
    const sceneForPrompt = replyFocusSummary || hintsSummary
      ? { ...promptScene, summary: [replyFocusSummary, promptScene.summary, hintsSummary].filter(Boolean).join('\n\n') }
      : promptScene
    const canUsePromptSpeciesAudio = hasTutorSceneCapability(promptScene.sceneCapabilities, 'speciesAudio')
    const availableAudios = canUsePromptSpeciesAudio
      ? mergeTutorAudios(
          promptScene.availableAudios ?? [],
          messageAudios,
          speciesHintsToAudioRefs(speciesHints),
        )
      : []

    const systemPrompt = buildTutorSystemPrompt({ scene: sceneForPrompt, profile: studentProfile, notebook })
    timing.mark('build_prompt')

    const encoder = new TextEncoder()
    let fullReply = ''
    // 客户端中途断开（关面板/刷新）后 enqueue 会抛错；用标记保证后续落库照常进行。
    let cancelled = false

    const readable = new ReadableStream({
      cancel() {
        cancelled = true
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

        try {
          if (TUTOR_TIMING_ENABLED) {
            safeEnqueue({ type: 'perf', phase: 'server_ready', timings: timing.snapshot() })
          }
          for (const toolCall of toolCalls) {
            safeEnqueue({ type: 'tool_call', toolCall })
          }

          const stream = streamChatWithTutor(systemPrompt, history)
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
            }
          }
          timing.mark('ai_stream_done')
        } catch (error) {
          if (creditResult.source) {
            await refundAiCredit(supabase, cost, creditResult.source).catch(() => undefined)
          }
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
          if (creditResult.source) {
            await refundAiCredit(supabase, cost, creditResult.source).catch(() => undefined)
          }
          safeEnqueue({ type: 'error', error: '小迪没有给出内容，请换个说法再试。' })
          safeClose()
          return
        }

        const replyAudios = canUsePromptSpeciesAudio
          ? mergeTutorAudios(
              availableAudios,
              await findSpeciesAudiosMentionedInText(supabase, `${content}\n${fullReply}`),
            )
          : []
        fullReply = finalizeReplyAudio(fullReply, content, replyAudios)
        timing.mark('finalize_audio')

        const meta: Record<string, unknown> = { ...(parsed.data.meta ?? {}) }
        if (typeof stageIndex === 'number') meta.stageIndex = stageIndex
        if (typeof lessonId === 'number') meta.lessonId = lessonId
        if (typeof lessonStepIndex === 'number') meta.lessonStepIndex = lessonStepIndex
        if (typeof lessonStepCount === 'number') meta.lessonStepCount = lessonStepCount
        if (typeof scratchBlockTargetItemIndex === 'number') {
          meta.scratchBlockTargetItemIndex = scratchBlockTargetItemIndex
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
            meta,
          },
        ] as never)

        if (insertError) {
          // 回复已生成并展示，不作废内容：退还代币、提示未保存，照常结束。
          if (creditResult.source) {
            await refundAiCredit(supabase, cost, creditResult.source).catch(() => undefined)
          }
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
            await maybeUpdateTutorNotebook(user.id)
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
        safeClose()
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
  } catch (error) {
    timing.log('request_error', {
      error: error instanceof Error ? error.message : String(error),
    })
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return handleApiError(error)
  }
}
