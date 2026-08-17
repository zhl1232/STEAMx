'use client'

import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { useQueryClient } from '@tanstack/react-query'

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
import type { AiCreditStatus } from '@/lib/ai/tutor/types'
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
  speechKey?: string
}

export type TutorSendMessageOptions = {
  forceReadReply?: boolean
}

export type TutorSendMessageFn = (text: string, images?: string[], options?: TutorSendMessageOptions) => Promise<void>

export type UseTutorChatStreamOptions = {
  contextKey: string
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
}

/**
 * 小迪流式对话控制器：消息状态、SSE POST 与解析、AbortController 生命周期、
 * 工具调用分发、配额与会话缓存联动。场景切换时中止旧流，避免旧话题串进新场景。
 */
export function useTutorChatStream({
  contextKey,
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
}: UseTutorChatStreamOptions) {
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [messages, setMessages] = useState<TutorChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [toolPendingCount, setToolPendingCount] = useState(0)
  const toolPendingCountRef = useRef(0)
  // 在途 SSE 请求的取消句柄：场景切换/卸载时中止旧流，避免旧话题内容串进新场景。
  const streamAbortRef = useRef<AbortController | null>(null)

  // 切换场景（换页面/换阶段）时清空旧话题的本地缓存并中止在途请求。
  // 旧流的 busyRef 不清会阻塞新场景应用会话数据。
  useEffect(() => {
    setMessages([])
    streamAbortRef.current?.abort()
    streamAbortRef.current = null
    toolPendingCountRef.current = 0
    setToolPendingCount(0)
  }, [contextKey])

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort()
    }
  }, [])

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

      busyRef.current = true
      setBusy(true)
      onBeforeSend()
      const userMessage: TutorChatMessage = {
        role: 'user',
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
        const next = [
          ...current,
          userMessage,
          { role: 'assistant' as const, content: '', streaming: true, speechKey: assistantSpeechKeyRef.current },
        ]
        return next
      })

      const withAssistantSpeechKey = (patch: TutorChatMessage): TutorChatMessage =>
        patch.role === 'assistant' && !patch.speechKey
          ? { ...patch, speechKey: assistantSpeechKeyRef.current }
          : patch

      // 用「找最后一条 streaming 占位」代替固定索引，避免 loadSession 等并发更新打乱下标。
      const patchStreaming = (patch: TutorChatMessage) => {
        setMessages((current) => {
          const next = [...current]
          for (let i = next.length - 1; i >= 0; i -= 1) {
            if (next[i].role === 'assistant' && next[i].streaming) {
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
          const next = [...current]
          for (let i = next.length - 1; i >= 0; i -= 1) {
            if (next[i].role === 'assistant') {
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

      streamAbortRef.current?.abort()
      const abortController = new AbortController()
      streamAbortRef.current = abortController
      let releasedBusy = false

      try {
        if (willSpeak) {
          await beginStreamedSpeech(assistantSpeechKeyRef.current)
        }
        const res = await fetch('/api/tutor/chat', {
          method: 'POST',
          signal: abortController.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contextType: context.contextType,
            contextId: context.contextId,
            content: trimmed,
            images: images ?? [],
            stageIndex,
            lessonId: context.lessonId,
            lessonStepIndex,
            lessonStepCount,
            scratchBlockTargetItemIndex,
            scratchEditorContext: scratchEditorContext ?? undefined,
            sceneCapabilities: clientToolCapabilities,
            surface: context.surface,
            gameKey: context.playgroundGameKey,
            speak: willSpeak,
          }),
        })
        const responseHeadersMs = TUTOR_CLIENT_TIMING_ENABLED ? markTiming() : 0
        const serverTiming = TUTOR_CLIENT_TIMING_ENABLED ? res.headers.get('Server-Timing') : null

        if (res.status === 402) {
          if (willSpeak) finishStreamedSpeech(assistantSpeechKeyRef.current)
          const payload = await res.json().catch(() => ({}))
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
          throw new Error(payload.error || '小迪暂时不可用')
        }

        let full = ''
        let streamError: string | null = null
        let streamWarning: string | null = null
        let toolFailed = false
        let sawToolCall = false
        let receivedAudio = false
        let speechPlaybackFailed = false
        let speechStreamWentStale = false
        let settledText = false

        const releaseBusy = () => {
          if (releasedBusy || streamAbortRef.current !== abortController) return
          releasedBusy = true
          busyRef.current = false
          setBusy(false)
        }

        const settleAssistantText = (content: string) => {
          if (settledText) return
          settledText = true
          const assistantMessage: TutorChatMessage = {
            role: 'assistant',
            content: content || '…',
            speechKey: assistantSpeechKeyRef.current,
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
              current
                ? {
                    ...current,
                    messages: [...(current.messages ?? []), userMessage, assistantMessage],
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
          } else if (event.type === 'done' && event.reply) {
            full = event.reply
            settleAssistantText(full)
          } else if (event.type === 'audio_done') {
            finishStreamedSpeech(assistantSpeechKeyRef.current)
          } else if (event.type === 'warning') {
            streamWarning = event.warning || null
          } else if (event.type === 'error') {
            streamError = event.error || '小迪暂时不可用'
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

        if (streamError) {
          if (willSpeak) finishStreamedSpeech(assistantSpeechKeyRef.current)
          if (full) {
            // 已有流式内容：保留内容，错误另起一条气泡，不覆盖回复
            patchLastAssistant({ role: 'assistant', content: full })
            setMessages((current) => [...current, { role: 'assistant', content: streamError, error: true }])
            setMascotFeedback('error')
            void refreshQuota()
            return
          }
          throw new Error(streamError)
        }

        if (!settledText) settleAssistantText(full || '…')
        const shouldSpeak = willSpeak
        const speechResult = shouldSpeak ? finishStreamedSpeech(assistantSpeechKeyRef.current) : null
        // null 表示这条语音已被另一条流/场景接管；只有收到过“stale”帧时才重试，
        // 避免用户主动停止后，旧 SSE 结束时又自动重新播放。
        const speechNeedsRetry = speechResult === false || speechStreamWentStale
        if (shouldSpeak && (speechPlaybackFailed || !receivedAudio) && speechNeedsRetry) {
          void playSpeech(full || '…', assistantSpeechKeyRef.current)
        }
      } catch (error) {
        if (willSpeak) finishStreamedSpeech(assistantSpeechKeyRef.current)
        if (abortController.signal.aborted) {
          // 场景切换主动中止：静默清掉流式占位气泡即可，不算错误。
          // 服务端会照常完成并落库，回复在历史里仍然可见。
          setMessages((current) => current.filter((message) => !(message.role === 'assistant' && message.streaming)))
          logTiming('aborted')
          return
        }
        logTiming('error', { error: error instanceof Error ? error.message : String(error) })
        patchStreaming({
          role: 'assistant',
          content: error instanceof Error ? error.message : '小迪暂时不可用，请稍后再试。',
          error: true,
        })
        setMascotFeedback('error')
      } finally {
        if (streamAbortRef.current === abortController) {
          streamAbortRef.current = null
          if (!releasedBusy) {
            busyRef.current = false
            setBusy(false)
          }
        }
      }
    },
    [
      user,
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

  return {
    messages,
    setMessages,
    busy,
    toolPendingCount,
    sendMessage,
  }
}
