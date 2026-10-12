'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { carryTutorMessages, tutorDisplayMessages, type TutorDisplayMessage, type TutorPreviousContext } from './tutor-carryover'
import { readTutorStreamEvents } from '@/components/features/tutor/tutor-stream-protocol'
import {
  tutorSessionQueryKey,
  type TutorSessionPayload,
  type TutorSessionQueryInput,
} from '@/components/features/tutor/tutor-session'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/context/auth-context'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'
import type { TutorMascotFeedback } from '@/lib/ai/tutor/mascot-state'
import type { TutorResourceClarification } from '@/lib/ai/tutor/resource-clarification'
import type { AiCreditStatus, TutorBilling } from '@/lib/ai/tutor/types'
import type { ResolvedTutorContext } from '@/lib/ai/tutor/resolve-context'
import type { TutorSceneCapability } from '@/lib/ai/tutor/scene-capabilities'
import type { TutorToolCall } from '@/lib/ai/tutor/tool-calls'
import type { ScratchEditorContext } from '@/lib/courses/scratch-messages'

const TUTOR_CLIENT_TIMING_ENABLED =
  process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_TUTOR_DEBUG_TIMING === '1'

export type TutorChatMessage = {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
  error?: boolean
  streaming?: boolean
  stopped?: boolean
  speechKey?: string
  clarification?: TutorResourceClarification
  billing?: TutorBilling
  requestId?: string
}

export type TutorSendMessageOptions = {
  forceReadReply?: boolean
  retryBody?: string
  retryOf?: string
}

export type TutorSendMessageFn = (text: string, images?: string[], options?: TutorSendMessageOptions) => Promise<void>

export type UseTutorChatStreamOptions = {
  contextKey: string
  epoch?: number
  sceneTitle?: string
  context: ResolvedTutorContext
  stageIndex?: number
  lessonStepIndex?: number
  lessonStepCount?: number
  scratchBlockTargetItemIndex?: number
  scratchEditorContext?: ScratchEditorContext | null
  clientToolCapabilities?: TutorSceneCapability[]
  dispatchToolCall?: (toolCall: TutorToolCall) => Promise<boolean>
  sessionInput: TutorSessionQueryInput | null
  /** 发送中标记（ref 版），loadSession 用它避免覆盖乐观插入的消息 */
  busyRef: MutableRefObject<boolean>
  autoReadReplies: boolean
  beginStreamedSpeech: (speechKey: string) => Promise<void>
  pushStreamedPcm: (pcm: string, sampleRate?: number, speechKey?: string) => boolean | null
  finishStreamedSpeech: (speechKey?: string) => boolean | null
  playSpeech: (text: string, speechKey: string) => void | Promise<void>
  setQuota: Dispatch<SetStateAction<AiCreditStatus | null>>
  refreshQuota: () => void | Promise<void>
  setMascotFeedback: (feedback: TutorMascotFeedback | null) => void
  /** 发送前清场：开场白、输入框、吉祥物反馈（须为稳定引用） */
  onBeforeSend: () => void
  onStopSpeech: () => void
}

/**
 * 小迪流式对话控制器：消息状态、SSE POST 与解析、AbortController 生命周期、
 * 工具调用分发、配额与会话缓存联动。场景切换时中止旧流，避免旧话题串进新场景。
 */
export function useTutorChatStream({
  contextKey,
  epoch,
  sceneTitle,
  context,
  stageIndex,
  lessonStepIndex,
  lessonStepCount,
  scratchBlockTargetItemIndex,
  scratchEditorContext,
  clientToolCapabilities,
  dispatchToolCall,
  sessionInput,
  busyRef,
  autoReadReplies,
  beginStreamedSpeech,
  pushStreamedPcm,
  finishStreamedSpeech,
  playSpeech,
  setQuota,
  refreshQuota,
  setMascotFeedback,
  onBeforeSend,
  onStopSpeech,
}: UseTutorChatStreamOptions) {
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [messages, setMessages] = useState<TutorChatMessage[]>([])
  const [carried, setCarried] = useState<TutorDisplayMessage[]>([])
  const [previousContext, setPreviousContext] = useState<TutorPreviousContext>()
  const [localRequestIds, setLocalRequestIds] = useState<ReadonlySet<string>>(() => new Set())
  const displayMessages = tutorDisplayMessages(carried, messages, sceneTitle, localRequestIds)
  const snapshotRef = useRef({ userId: user?.id, contextKey, context, stageIndex, displayMessages, epoch })
  const [busy, setBusy] = useState(false)
  const [toolPendingCount, setToolPendingCount] = useState(0)
  const [streamPhase, setStreamPhase] = useState<'preparing' | 'generating' | null>(null)
  const [failedMessage, setFailedMessage] = useState<{ text: string; images?: string[]; retryable: boolean; requestBody: string; newAttempt: boolean } | null>(null)
  const toolPendingCountRef = useRef(0)
  // 在途 SSE 请求的取消句柄：场景切换/卸载时中止旧流，避免旧话题内容串进新场景。
  const streamAbortRef = useRef<AbortController | null>(null)
  const generationRef = useRef(0)
  const scope = `${user?.id ?? 'anonymous'}:${contextKey}:${epoch ?? 'loading'}`
  const scopeRef = useRef(scope)
  const effectScopeRef = useRef(scope)
  useLayoutEffect(() => { scopeRef.current = scope }, [scope])

  const resetChat = useCallback((preserveCarry = false) => {
    if (!preserveCarry) { setCarried([]); setPreviousContext(undefined) }
    setLocalRequestIds(new Set())
    generationRef.current += 1
    streamAbortRef.current?.abort()
    streamAbortRef.current = null
    busyRef.current = false
    setBusy(false)
    setStreamPhase(null)
    setFailedMessage(null)
    setMessages([])
    toolPendingCountRef.current = 0
    setToolPendingCount(0)
  }, [busyRef])

  // 切换场景（换页面/换阶段）时清空旧话题的本地缓存并中止在途请求。
  // 旧流的 busyRef 不清会阻塞新场景应用会话数据。
  useEffect(() => {
    if (effectScopeRef.current !== scope) onStopSpeech()
    effectScopeRef.current = scope
    const previous = snapshotRef.current
    const switching = previous.contextKey !== contextKey && previous.userId === user?.id && Boolean(user?.id)
    if (switching) {
      const next = carryTutorMessages(previous.displayMessages)
      setCarried(next)
      setPreviousContext(next.length ? {
        contextType: previous.context.contextType, contextId: previous.context.contextId,
        stageIndex: previous.stageIndex, lessonId: previous.context.lessonId,
        surface: previous.context.surface, gameKey: previous.context.playgroundGameKey,
      } : undefined)
    }
    // Loading the new page's epoch must not erase the carried segment.
    resetChat(switching || (previous.userId === user?.id && previous.epoch === undefined))
    // The snapshot belongs to the last committed render, before the scope reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, resetChat, onStopSpeech])

  useEffect(() => {
    snapshotRef.current = { userId: user?.id, contextKey, context, stageIndex, displayMessages, epoch }
  })

  useEffect(() => {
    return () => {
      generationRef.current += 1
      streamAbortRef.current?.abort()
      busyRef.current = false
    }
  }, [busyRef])

  const stopGeneration = useCallback(() => {
    generationRef.current += 1
    streamAbortRef.current?.abort()
    streamAbortRef.current = null
    busyRef.current = false
    setBusy(false)
    setStreamPhase(null)
    toolPendingCountRef.current = 0
    setToolPendingCount(0)
    onStopSpeech()
    if (sessionInput) void queryClient.invalidateQueries({ queryKey: tutorSessionQueryKey(sessionInput), refetchType: 'none' })
    setMessages((current) => current.map((message) => message.streaming
      ? { ...message, streaming: false, stopped: true }
      : message))
  }, [busyRef, onStopSpeech, queryClient, sessionInput])

  const sendMessage = useCallback<TutorSendMessageFn>(
    async (text, images, options = {}) => {
      if (!user) {
        promptLogin(() => undefined, {
          title: '登录后找小迪',
          description: '登录后即可和 AI 导师小迪一对一聊天。',
        })
        return
      }

      const trimmed = text.trim()
      if (!trimmed && (!images || images.length === 0)) return
      if (busyRef.current) return
      if (!options.retryBody && !Number.isSafeInteger(epoch)) {
        toast({ title: '对话正在加载，请稍后发送。' })
        return
      }
      const requestBody = options.retryBody ?? JSON.stringify({
        requestId: crypto.randomUUID(), epoch, previousContext,
        contextType: context.contextType, contextId: context.contextId,
        content: trimmed, images: images ?? [], stageIndex, lessonId: context.lessonId,
        lessonStepIndex, lessonStepCount, scratchBlockTargetItemIndex,
        scratchEditorContext: scratchEditorContext ?? undefined, sceneCapabilities: clientToolCapabilities,
        surface: context.surface, gameKey: context.playgroundGameKey,
        speak: Boolean(autoReadReplies || options.forceReadReply),
      })
      const { requestId, epoch: requestEpoch } = JSON.parse(requestBody) as { requestId: string; epoch: number }
      setLocalRequestIds((current) => new Set([...current, requestId]))
      const generation = ++generationRef.current
      const requestScope = scopeRef.current
      const isCurrent = () => generationRef.current === generation && scopeRef.current === requestScope
      streamAbortRef.current?.abort()
      const abortController = new AbortController()
      streamAbortRef.current = abortController
      let releasedBusy = false
      let full = ''
      let settledText = false
      let retryable = true
      let newAttempt = false
      let replayed = false

      busyRef.current = true
      setBusy(true)
      setStreamPhase('preparing')
      setFailedMessage(null)
      onBeforeSend()
      const userMessage: TutorChatMessage = {
        role: 'user',
        requestId,
        content: trimmed,
        images: images?.length ? images : undefined,
      }
      const timingStart = TUTOR_CLIENT_TIMING_ENABLED ? performance.now() : 0
      let firstEventMs: number | null = null
      let firstChunkMs: number | null = null
      const markTiming = () => Math.round(performance.now() - timingStart)
      const logTiming = (outcome: string, details?: Record<string, unknown>) => {
        if (!TUTOR_CLIENT_TIMING_ENABLED) return
        console.info('[tutor timing]', {
          label: 'client tutor send',
          outcome,
          totalMs: markTiming(),
          firstEventMs,
          firstChunkMs,
          ...details,
        })
      }
      const willSpeak = Boolean(autoReadReplies || options.forceReadReply)
      // Keep a unique stream key stable before the state updater runs. The
      // updater may execute after beginStreamedSpeech(), so deriving this from
      // the eventual message index can make every audio frame look stale.
      const assistantSpeechKeyRef = {
        current: `chat-live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      }
      setMessages((current) => {
        if (!isCurrent()) return current
        const next = [
          ...current.filter((message) => !options.retryOf || message.requestId !== options.retryOf),
          userMessage,
          { role: 'assistant' as const, requestId, content: '', streaming: true, speechKey: assistantSpeechKeyRef.current },
        ]
        return next
      })

      const withAssistantSpeechKey = (patch: TutorChatMessage): TutorChatMessage =>
        patch.role === 'assistant' && !patch.speechKey
          ? { ...patch, requestId, speechKey: assistantSpeechKeyRef.current }
          : patch

      // 用「找最后一条 streaming 占位」代替固定索引，避免 loadSession 等并发更新打乱下标。
      const patchStreaming = (patch: TutorChatMessage) => {
        setMessages((current) => {
          if (!isCurrent()) return current
          const next = [...current]
          for (let i = next.length - 1; i >= 0; i -= 1) {
            if (next[i].speechKey === assistantSpeechKeyRef.current) {
              next[i] = withAssistantSpeechKey(patch)
              return next
            }
          }
          next.push(withAssistantSpeechKey(patch))
          return next
        })
      }

      const patchLastAssistant = (patch: TutorChatMessage) => {
        setMessages((current) => {
          if (!isCurrent()) return current
          const next = [...current]
          for (let i = next.length - 1; i >= 0; i -= 1) {
            if (next[i].speechKey === assistantSpeechKeyRef.current) {
              next[i] = withAssistantSpeechKey(patch)
              return next
            }
          }
          next.push(withAssistantSpeechKey(patch))
          return next
        })
      }

      const beginToolWork = () => {
        toolPendingCountRef.current += 1
        setToolPendingCount(toolPendingCountRef.current)
      }
      const endToolWork = () => {
        if (!isCurrent()) return
        toolPendingCountRef.current = Math.max(0, toolPendingCountRef.current - 1)
        setToolPendingCount(toolPendingCountRef.current)
      }
      const runToolCall = async (toolCall: TutorToolCall) => {
        beginToolWork()
        try {
          if (!dispatchToolCall) return false
          return await dispatchToolCall(toolCall)
        } catch {
          return false
        } finally {
          endToolWork()
        }
      }

      try {
        if (willSpeak) {
          await beginStreamedSpeech(assistantSpeechKeyRef.current)
        }
        if (!isCurrent()) return
        const res = await fetch('/api/tutor/chat', {
          method: 'POST',
          signal: abortController.signal,
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
        })
        if (!isCurrent()) return
        const responseHeadersMs = TUTOR_CLIENT_TIMING_ENABLED ? markTiming() : 0
        const serverTiming = TUTOR_CLIENT_TIMING_ENABLED ? res.headers.get('Server-Timing') : null

        if (res.status === 402) {
          if (willSpeak) finishStreamedSpeech(assistantSpeechKeyRef.current)
          const payload = await res.json().catch(() => ({}))
          if (!isCurrent()) return
          setQuota((q) => (q ? { ...q, canChat: false } : q))
          patchStreaming({
            role: 'assistant',
            content: payload.error ?? '今日免费次数或本月代币已用完。开通会员每月可获 1500 代币～',
            error: true,
          })
          setMascotFeedback('error')
          logTiming('quota_exceeded', { responseHeadersMs, serverTiming })
          return
        }

        if (!res.ok || !res.body) {
          const payload = await res.json().catch(() => ({}))
          if (!isCurrent()) return
          retryable = ![400, 401, 403, 402].includes(res.status) && !['stale_topic', 'conflict', 'unavailable'].includes(payload.requestState)
          newAttempt = payload.requestState === 'failed'
          if (payload.requestState === 'stale_topic' && sessionInput) void queryClient.invalidateQueries({ queryKey: tutorSessionQueryKey(sessionInput) })
          throw new Error(payload.error || '小迪暂时不可用')
        }

        setStreamPhase('generating')
        let streamError: string | null = null
        let streamWarning: string | null = null
        let toolFailed = false
        let sawToolCall = false
        let receivedAudio = false
        let speechPlaybackFailed = false
        let speechStreamWentStale = false
        let clarification: TutorResourceClarification | undefined

        const releaseBusy = () => {
          if (releasedBusy || streamAbortRef.current !== abortController) return
          releasedBusy = true
          busyRef.current = false
          setBusy(false)
          setStreamPhase(null)
        }

        const settleAssistantText = (
          content: string,
          messageClarification?: TutorResourceClarification,
          billing?: TutorBilling,
        ) => {
          if (settledText || !isCurrent()) return
          settledText = true
          const assistantMessage: TutorChatMessage = {
            role: 'assistant',
            requestId,
            content: content || '…',
            speechKey: assistantSpeechKeyRef.current,
            ...(messageClarification ? { clarification: messageClarification } : {}),
            ...(billing ? { billing } : {}),
          }
          patchLastAssistant(assistantMessage)
          releaseBusy()
          if (toolFailed) {
            setMascotFeedback('error')
          } else if (!willSpeak) {
            setMascotFeedback('success')
          }
          if (sessionInput) {
            queryClient.setQueryData<TutorSessionPayload>(tutorSessionQueryKey(sessionInput), (current) =>
              current && current.epoch === requestEpoch
                ? {
                    ...current,
                    messages: [...(current.messages ?? []).filter((message) => message.requestId !== requestId
                      && (!options.retryOf || message.requestId !== options.retryOf)), userMessage, assistantMessage],
                    greeting: null,
                  }
                : current,
            )
          }
          if (streamWarning) {
            toast({ title: streamWarning, variant: 'destructive' })
          }
          logTiming('done', {
            responseHeadersMs,
            serverTiming,
            replyLength: content.length,
            sawToolCall,
            toolFailed,
          })
          void refreshQuota()
        }

        for await (const event of readTutorStreamEvents(res.body)) {
          if (!isCurrent()) return
          if (TUTOR_CLIENT_TIMING_ENABLED && firstEventMs == null) {
            firstEventMs = markTiming()
          }
          if (event.type === 'chunk' && event.content) {
            if (TUTOR_CLIENT_TIMING_ENABLED && firstChunkMs == null) {
              firstChunkMs = markTiming()
            }
            full += event.content
            patchStreaming({ role: 'assistant', content: full, streaming: true })
          } else if (event.type === 'audio' && event.pcm) {
            const accepted = pushStreamedPcm(event.pcm, event.sampleRate, assistantSpeechKeyRef.current)
            receivedAudio = accepted === true || receivedAudio
            speechPlaybackFailed = speechPlaybackFailed || accepted === false
            speechStreamWentStale = speechStreamWentStale || accepted === null
          } else if (event.type === 'clarification' && event.clarification) {
            clarification = event.clarification
          } else if (event.type === 'done' && event.reply) {
            full = event.reply
            replayed = event.replayed === true
            settleAssistantText(full, clarification, event.billing)
          } else if (event.type === 'audio_done') {
            finishStreamedSpeech(assistantSpeechKeyRef.current)
          } else if (event.type === 'warning') {
            streamWarning = event.warning || null
          } else if (event.type === 'error') {
            streamError = event.error || '小迪暂时不可用'
            retryable = true
            newAttempt = event.requestState === 'failed'
          } else if (event.type === 'tool_call' && event.toolCall) {
            sawToolCall = true
            const ok = await runToolCall(event.toolCall)
            if (!ok) toolFailed = true
          } else if (event.type === 'perf' && TUTOR_CLIENT_TIMING_ENABLED) {
            console.info('[tutor timing]', {
              label: 'server tutor stream',
              phase: event.phase,
              timings: event.timings,
            })
          }
        }
        if (!isCurrent()) return

        if (streamError) {
          if (willSpeak) finishStreamedSpeech(assistantSpeechKeyRef.current)
          throw new Error(streamError)
        }

        if (!settledText) throw new Error('连接中断，请稍后重新打开对话，查看回复是否已保存。')
        const shouldSpeak = willSpeak && !replayed
        const speechResult = willSpeak ? finishStreamedSpeech(assistantSpeechKeyRef.current) : null
        // null 表示语音已被停止或另一个音频会话接管；迟到的 PCM 不能让旧答复
        // 再次抢占课程语音。只有仍然拥有播放会话的失败才允许自动补播。
        const speechNeedsRetry = speechResult !== null && (speechResult === false || speechStreamWentStale)
        if (shouldSpeak && (speechPlaybackFailed || !receivedAudio) && speechNeedsRetry) {
          void playSpeech(full || '…', assistantSpeechKeyRef.current)
        }
      } catch (error) {
        if (!isCurrent()) return
        if (willSpeak) finishStreamedSpeech(assistantSpeechKeyRef.current)
        if (abortController.signal.aborted) {
          logTiming('aborted')
          return
        }
        // The text is already saved when done arrives; an audio transport failure must not replace it.
        if (settledText) return
        logTiming('error', { error: error instanceof Error ? error.message : String(error) })
        const errorText = error instanceof Error ? error.message : '小迪暂时不可用，请稍后再试。'
        patchStreaming({
          role: 'assistant',
          content: full ? `${full}\n\n${errorText}` : errorText,
          error: true,
        })
        setFailedMessage({ text: trimmed, images, retryable, requestBody, newAttempt })
        setMascotFeedback('error')
        void refreshQuota()
      } finally {
        if (isCurrent() && streamAbortRef.current === abortController) {
          streamAbortRef.current = null
          setStreamPhase(null)
          if (!releasedBusy) {
            busyRef.current = false
            setBusy(false)
          }
        }
      }
    },
    [
      user,
      epoch,
      previousContext,
      context.contextType,
      context.contextId,
      context.lessonId,
      context.surface,
      context.playgroundGameKey,
      stageIndex,
      lessonStepIndex,
      lessonStepCount,
      scratchBlockTargetItemIndex,
      scratchEditorContext,
      promptLogin,
      queryClient,
      refreshQuota,
      sessionInput,
      toast,
      dispatchToolCall,
      clientToolCapabilities,
      autoReadReplies,
      beginStreamedSpeech,
      pushStreamedPcm,
      finishStreamedSpeech,
      playSpeech,
      busyRef,
      onBeforeSend,
      setMascotFeedback,
      setQuota,
    ],
  )

  const retryLastMessage = useCallback(async () => {
    if (!failedMessage?.retryable || busyRef.current) return
    const original = JSON.parse(failedMessage.requestBody) as { requestId: string }
    const retryBody = failedMessage.newAttempt
      ? JSON.stringify({ ...original, requestId: crypto.randomUUID() })
      : failedMessage.requestBody
    await sendMessage(failedMessage.text, failedMessage.images, { retryBody, retryOf: original.requestId })
  }, [busyRef, failedMessage, sendMessage])

  return {
    displayMessages,
    hasCarried: carried.length > 0,
    messages,
    setMessages,
    busy,
    toolPendingCount,
    sendMessage,
    resetChat,
    stopGeneration,
    streamPhase,
    failedMessage,
    retryLastMessage,
    clearFailedMessage: () => setFailedMessage(null),
  }
}
