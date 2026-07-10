'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ChevronDown,
  History,
  Loader2,
  MessageSquarePlus,
  Mic,
  MoreHorizontal,
  Plus,
  Send,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { OptimizedImage } from '@/components/ui/optimized-image'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { XiaoDi, type XiaoDiState } from '@/components/features/tutor/xiaodi'
import { useOptionalTutorContext } from '@/components/features/tutor/tutor-context'
import {
  resolveTutorMascotState,
  type TutorMascotFeedback,
} from '@/lib/ai/tutor/mascot-state'
import {
  buildTutorChatParams,
  fetchTutorSession,
  TUTOR_SESSION_STALE_MS,
  tutorSessionQueryKey,
  type TutorSessionPayload,
  type TutorSessionQueryInput,
} from '@/components/features/tutor/tutor-session'
import { TutorMessageContent } from '@/components/features/tutor/tutor-message-content'
import {
  createTutorPcmRecorder,
  getTutorVoicePreferences,
  markTutorLongPressHintShown,
  mergeTutorVoiceTranscript,
  setTutorVoicePreference,
  shouldShowTutorLongPressHint,
  TUTOR_VOICE_HINT_STATE_STORAGE_KEY,
  TUTOR_VOICE_MAX_RECORDING_MS,
  TUTOR_VOICE_PREFERENCES_CHANGE_EVENT,
  type TutorPcmRecorder,
  type TutorVoicePreferences,
} from '@/components/features/tutor/tutor-voice'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/context/auth-context'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'
import { hasTutorSceneCapability } from '@/lib/ai/tutor/scene-capabilities'
import type { AiCreditStatus, TutorGreeting } from '@/lib/ai/tutor/types'
import type { ResolvedTutorContext } from '@/lib/ai/tutor/resolve-context'
import { buildStartStagePrompt } from '@/lib/ai/tutor/greeting'
import type { TutorToolCall } from '@/lib/ai/tutor/tool-calls'
import type { ScratchEditorContext } from '@/lib/courses/scratch-messages'
import { AI_CREDIT_COST_VISION, MEMBER_AI_MONTHLY_CREDITS } from '@/lib/membership'
import { SecureUploadError, getSecureUploadErrorMessage, uploadFileSecure } from '@/lib/utils/upload'
import { cn } from '@/lib/utils'

/** 单条消息最多携带的图片数（与服务端引擎一致） */
const MAX_CHAT_IMAGES = 4
const TUTOR_LONG_PRESS_RECORDING_MS = 380
const TUTOR_LONG_PRESS_HINT_VISIBLE_MS = 6500
const TUTOR_CLIENT_TIMING_ENABLED =
  process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_TUTOR_DEBUG_TIMING === '1'
const COMPOSER_MIN_HEIGHT_PX = 56
const COMPOSER_MAX_HEIGHT_PX = 128
const composerToolButtonClass =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-transparent text-foreground/80 transition-[background-color,border-color,box-shadow,transform] hover:border-[hsl(var(--brand-blue)/0.2)] hover:bg-[hsl(var(--status-info-surface)/0.68)] hover:text-[hsl(var(--brand-blue))] active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-blue)/0.28)] disabled:cursor-not-allowed disabled:opacity-45'
const composerSendButtonClass =
  'h-10 w-10 shrink-0 rounded-full bg-[hsl(var(--brand-blue))] text-[hsl(var(--brand-blue-foreground))] shadow-[0_14px_26px_-14px_hsl(var(--brand-blue)/0.95)] transition-[background-color,box-shadow,transform] hover:bg-[hsl(var(--brand-blue)/0.92)] hover:shadow-[0_16px_30px_-14px_hsl(var(--brand-blue)/0.85)] active:scale-95 disabled:bg-[hsl(var(--surface-muted))] disabled:text-muted-foreground disabled:shadow-none disabled:opacity-70'
const VOICE_WAVE_BARS = [8, 14, 10, 16, 9]

function getTutorUploadToast(error: unknown): { title: string; description: string } {
  const message = getSecureUploadErrorMessage(error, '请确认网络或稍后重试。')

  if (error instanceof SecureUploadError && error.code === 'image_content_rejected') {
    return {
      title: '这张图片不能发给小迪',
      description: `${message} 请换一张与项目、手工、课程或自然观察有关的图片。`,
    }
  }

  return {
    title: '图片上传失败',
    description: message,
  }
}

async function readTutorSpeechError(res: Response, fallback: string) {
  const payload = await res.json().catch(() => null)
  if (payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string') {
    return (payload as { error: string }).error
  }
  return fallback
}

export type TutorChatMessage = {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
  error?: boolean
  streaming?: boolean
}

type TutorPanelView = 'chat' | 'history' | 'historyDetail'

type TutorHistoryItem = {
  id: string
  title: string
  preview: string
  createdAt: string
  archivedAt: string | null
}

type TutorHistoryDetail = {
  id: string
  title: string
  archivedAt: string | null
  messages: TutorChatMessage[]
}

type TutorStreamEvent = {
  type?: string
  content?: string
  reply?: string
  error?: string
  warning?: string
  toolCall?: TutorToolCall
  phase?: string
  timings?: Array<{ name: string; elapsedMs: number; deltaMs: number }>
}

type TutorSendMessageOptions = {
  forceReadReply?: boolean
}

type TutorSendMessageFn = (text: string, images?: string[], options?: TutorSendMessageOptions) => Promise<void>
type TutorVoiceRecordingMode = 'composer' | 'longPress'

type TutorPanelProps = {
  open: boolean
  onToggle: () => void
  context: ResolvedTutorContext
  stageIndex?: number
  lessonStepIndex?: number
  lessonStepCount?: number
  scratchBlockTargetItemIndex?: number
  scratchEditorContext?: ScratchEditorContext | null
  stageTitle?: string
  subtitle?: string
  quickPrompts?: string[]
  onReview?: () => void
  showReviewAction?: boolean
  /** compact：无底部导航的工作区页面（如 Scratch 课时页），贴近底边并避开编辑器右下按钮 */
  fabPlacement?: 'default' | 'compact'
  /** Hide the floating tutor affordance on phone-sized viewports when it would cover primary content. */
  hideOnMobile?: boolean
}

function formatQuota(quota: AiCreditStatus | null) {
  if (!quota) return null
  if (quota.isMember) {
    return `本月代币 ${quota.walletBalance}/${quota.monthlyGrant || MEMBER_AI_MONTHLY_CREDITS}`
  }
  return `今日免费 ${quota.freeRemainingToday}/${quota.freeDaily}`
}

function formatVoiceElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

type TutorVoiceFeedback = {
  tone: 'recording' | 'processing' | 'speaking'
  title: string
  detail: string
  elapsedMs?: number
  canStopSpeech?: boolean
}

export function GlobalTutorFab({
  open,
  onToggle,
  context,
  stageIndex,
  lessonStepIndex,
  lessonStepCount,
  scratchBlockTargetItemIndex,
  scratchEditorContext,
  stageTitle,
  subtitle,
  quickPrompts = [],
  onReview,
  showReviewAction = false,
  fabPlacement = 'default',
  hideOnMobile = false,
}: TutorPanelProps) {
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const { toast } = useToast()
  const tutorCtx = useOptionalTutorContext()
  const dispatchTutorToolCall = tutorCtx?.dispatchToolCall
  const queryClient = useQueryClient()

  const [mounted, setMounted] = useState(false)
  const [messages, setMessages] = useState<TutorChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [mascotFeedback, setMascotFeedback] = useState<TutorMascotFeedback | null>(null)
  const [toolPendingCount, setToolPendingCount] = useState(0)
  const toolPendingCountRef = useRef(0)
  const [quota, setQuota] = useState<AiCreditStatus | null>(null)
  const [greeting, setGreeting] = useState<TutorGreeting | null>(null)
  const [sceneTitle, setSceneTitle] = useState('')
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const [suggestedImages, setSuggestedImages] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [recordingVoice, setRecordingVoice] = useState(false)
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null)
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0)
  const [transcribingVoice, setTranscribingVoice] = useState(false)
  const [voicePreferences, setVoicePreferences] = useState<TutorVoicePreferences>(() => getTutorVoicePreferences(null))
  const [coarsePointer, setCoarsePointer] = useState(false)
  const [showVoiceHint, setShowVoiceHint] = useState(false)
  const [speechLoadingKey, setSpeechLoadingKey] = useState<string | null>(null)
  const [playingSpeechKey, setPlayingSpeechKey] = useState<string | null>(null)
  const [view, setView] = useState<TutorPanelView>('chat')
  const [historyItems, setHistoryItems] = useState<TutorHistoryItem[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyDetail, setHistoryDetail] = useState<TutorHistoryDetail | null>(null)
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false)
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null)
  const recorderRef = useRef<TutorPcmRecorder | null>(null)
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressActiveRef = useRef(false)
  const longPressReleasePendingRef = useRef(false)
  const suppressNextToggleRef = useRef(false)
  const voiceRecordingModeRef = useRef<TutorVoiceRecordingMode>('composer')
  const speechAudioRef = useRef<HTMLAudioElement | null>(null)
  const speechObjectUrlRef = useRef<string | null>(null)
  const speechRequestIdRef = useRef(0)
  const pendingAutoReadTextRef = useRef<string | null>(null)
  const pendingAutoReadForceRef = useRef(false)
  const sendMessageRef = useRef<TutorSendMessageFn | null>(null)
  // 发送中标记（ref 版），loadSession 用它避免覆盖乐观插入的消息。
  const busyRef = useRef(false)
  const autoReadReplies = voicePreferences.autoReadReplies

  const contextKey = `${context.contextType}:${context.contextId}:${stageIndex ?? ''}:${context.lessonId ?? ''}:${context.surface ?? ''}`
  // 最新场景 key 放 ref，loadSession 响应回来时丢弃过期场景的数据（防快速切换串话题）。
  const contextKeyRef = useRef(contextKey)
  contextKeyRef.current = contextKey

  const sessionInput = useMemo<TutorSessionQueryInput | null>(() => {
    if (!user?.id) return null
    return {
      userId: user.id,
      contextType: context.contextType,
      contextId: context.contextId,
      stageIndex,
      lessonId: context.lessonId,
      surface: context.surface,
    }
  }, [user?.id, context.contextType, context.contextId, stageIndex, context.lessonId, context.surface])

  const sessionQueryKey = useMemo(
    () => (sessionInput ? tutorSessionQueryKey(sessionInput) : (['tutor-session', 'disabled'] as const)),
    [sessionInput],
  )

  const sessionQuery = useQuery({
    queryKey: sessionQueryKey,
    queryFn: () => {
      if (!sessionInput) throw new Error('Missing tutor session input')
      return fetchTutorSession(sessionInput)
    },
    enabled: open && Boolean(sessionInput),
    staleTime: TUTOR_SESSION_STALE_MS,
  })
  const clientToolCapabilities = tutorCtx?.override.sceneCapabilities
  const serverSceneCapabilities = sessionQuery.data?.scene?.sceneCapabilities
  const allowAudioMessages = hasTutorSceneCapability(serverSceneCapabilities, 'speciesAudio')

  const buildParams = useCallback(() => {
    return buildTutorChatParams({
      contextType: context.contextType,
      contextId: context.contextId,
      stageIndex,
      lessonId: context.lessonId,
      surface: context.surface,
    })
  }, [context.contextType, context.contextId, stageIndex, context.lessonId, context.surface])

  const applySessionPayload = useCallback((payload: TutorSessionPayload) => {
    setQuota(payload.quota ?? null)
    setSceneTitle(payload.scene?.title ?? '')
    setSuggestedImages(Array.isArray(payload.scene?.suggestedImages) ? payload.scene.suggestedImages : [])
    // 正在流式发送时不要用 DB 历史覆盖本地乐观消息
    if (!busyRef.current) {
      setMessages((payload.messages ?? []).map((m: TutorChatMessage) => ({ ...m })))
      setGreeting(payload.greeting ?? null)
    }
  }, [])

  const loadSession = useCallback(async () => {
    if (!sessionInput) return
    const requestKey = contextKeyRef.current
    try {
      const payload = await queryClient.fetchQuery({
        queryKey: tutorSessionQueryKey(sessionInput),
        queryFn: () => fetchTutorSession(sessionInput),
        staleTime: 0,
      })
      // 响应期间场景已切换：丢弃，避免旧话题数据串进新话题
      if (contextKeyRef.current !== requestKey) return
      applySessionPayload(payload)
    } catch {
      // 网络异常保持本地状态
    }
  }, [applySessionPayload, queryClient, sessionInput])

  const refreshQuota = useCallback(async () => {
    try {
      const res = await fetch(`/api/tutor/chat?${buildParams()}&quotaOnly=1`)
      if (!res.ok) return
      const payload = await res.json()
      const nextQuota = payload.quota ?? null
      setQuota(nextQuota)
      if (sessionInput) {
        queryClient.setQueryData<TutorSessionPayload>(tutorSessionQueryKey(sessionInput), (current) =>
          current ? { ...current, quota: nextQuota } : current,
        )
      }
    } catch {
      // ignore
    }
  }, [buildParams, queryClient, sessionInput])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const syncPreferences = () => setVoicePreferences(getTutorVoicePreferences())

    syncPreferences()
    window.addEventListener(TUTOR_VOICE_PREFERENCES_CHANGE_EVENT, syncPreferences)
    window.addEventListener('storage', syncPreferences)
    return () => {
      window.removeEventListener(TUTOR_VOICE_PREFERENCES_CHANGE_EVENT, syncPreferences)
      window.removeEventListener('storage', syncPreferences)
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)')
    const syncPointer = () => setCoarsePointer(media.matches)

    syncPointer()
    media.addEventListener('change', syncPointer)
    return () => media.removeEventListener('change', syncPointer)
  }, [])

  useEffect(() => {
    if (
      !mounted ||
      open ||
      hideOnMobile ||
      !coarsePointer ||
      !voicePreferences.mobileLongPressInput ||
      !voicePreferences.showLongPressHint
    ) {
      setShowVoiceHint(false)
      return
    }

    if (!shouldShowTutorLongPressHint(localStorage.getItem(TUTOR_VOICE_HINT_STATE_STORAGE_KEY))) return

    setShowVoiceHint(true)
    markTutorLongPressHintShown()
    const timeout = setTimeout(() => setShowVoiceHint(false), TUTOR_LONG_PRESS_HINT_VISIBLE_MS)
    return () => clearTimeout(timeout)
  }, [
    coarsePointer,
    hideOnMobile,
    mounted,
    open,
    voicePreferences.mobileLongPressInput,
    voicePreferences.showLongPressHint,
  ])

  // 切换场景（换页面/换阶段）时清空旧话题的本地缓存，等重新加载。
  useEffect(() => {
    setMessages([])
    setGreeting(null)
    setSceneTitle('')
    setPendingImages([])
    setSuggestedImages([])
    setView('chat')
    setHistoryItems(null)
    setHistoryDetail(null)
  }, [contextKey])

  useEffect(() => {
    if (!sessionQuery.data) return
    applySessionPayload(sessionQuery.data)
  }, [applySessionPayload, sessionQuery.data])

  useEffect(() => {
    // busy 时不消费，等当前回复结束后 effect 因 busy 变化重跑再发送，避免丢消息。
    if (!open || !user || busy || !tutorCtx?.pendingSend) return
    const pending = tutorCtx.consumePendingSend()
    if (pending) {
      void sendMessage(pending.text, pending.images)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user, busy, tutorCtx?.pendingSend])

  useEffect(() => {
    if (!scrollRef.current || view !== 'chat') return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, busy, open, view])

  // 历史视图从顶部开始阅读
  useEffect(() => {
    if (!scrollRef.current || view === 'chat') return
    scrollRef.current.scrollTop = 0
  }, [view, historyDetail])

  useEffect(() => {
    if (!recordingVoice || recordingStartedAt == null) return

    const syncElapsed = () => setRecordingElapsedMs(Date.now() - recordingStartedAt)
    syncElapsed()
    const timer = setInterval(syncElapsed, 250)
    return () => clearInterval(timer)
  }, [recordingStartedAt, recordingVoice])

  const stopSpeechPlayback = useCallback(() => {
    speechRequestIdRef.current += 1
    const audio = speechAudioRef.current
    if (audio) {
      audio.pause()
      audio.src = ''
    }
    if (speechObjectUrlRef.current) {
      URL.revokeObjectURL(speechObjectUrlRef.current)
    }
    speechAudioRef.current = null
    speechObjectUrlRef.current = null
    setPlayingSpeechKey(null)
    setSpeechLoadingKey(null)
  }, [])

  const playSpeech = useCallback(
    async (text: string, speechKey: string) => {
      if (!text.trim()) return
      if (playingSpeechKey === speechKey) {
        stopSpeechPlayback()
        return
      }

      stopSpeechPlayback()
      const speechRequestId = speechRequestIdRef.current
      setSpeechLoadingKey(speechKey)

      try {
        const res = await fetch('/api/tutor/speech/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })

        if (!res.ok) {
          throw new Error(await readTutorSpeechError(res, '小迪语音暂时不可用，请稍后再试。'))
        }

        const blob = await res.blob()
        if (speechRequestIdRef.current !== speechRequestId) return
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        speechObjectUrlRef.current = url
        speechAudioRef.current = audio
        setPlayingSpeechKey(speechKey)
        setSpeechLoadingKey(null)

        audio.onended = stopSpeechPlayback
        audio.onerror = stopSpeechPlayback
        try {
          await audio.play()
        } catch (error) {
          if (speechRequestIdRef.current !== speechRequestId) return
          throw error
        }
      } catch (error) {
        if (speechRequestIdRef.current !== speechRequestId) return
        stopSpeechPlayback()
        toast({
          title: error instanceof Error ? error.message : '小迪语音暂时不可用，请稍后再试。',
          variant: 'destructive',
        })
      }
    },
    [playingSpeechKey, stopSpeechPlayback, toast],
  )

  const finishVoiceRecording = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder || transcribingVoice) return
    recorderRef.current = null
    const recordingMode = voiceRecordingModeRef.current
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    setRecordingVoice(false)
    setRecordingStartedAt(null)
    setTranscribingVoice(true)
    const requestKey = contextKeyRef.current

    try {
      const recording = await recorder.stop()
      if (recording.durationMs < 350 || recording.blob.size <= 0) {
        toast({ title: '没有录到声音，请再试一次。', variant: 'destructive' })
        return
      }

      const formData = new FormData()
      formData.append('audio', recording.blob, 'xiaodi-voice.pcm')
      formData.append('durationMs', String(Math.min(recording.durationMs, TUTOR_VOICE_MAX_RECORDING_MS)))
      const res = await fetch('/api/tutor/speech/transcribe', { method: 'POST', body: formData })
      if (!res.ok) {
        throw new Error(await readTutorSpeechError(res, '小迪没有听清楚，请再说一次。'))
      }
      const payload = await res.json().catch(() => null)
      const transcript = typeof payload?.transcript === 'string' ? payload.transcript.trim() : ''
      if (contextKeyRef.current !== requestKey) return
      if (!transcript) {
        toast({ title: '小迪没有听清楚，请再说一次。', variant: 'destructive' })
        return
      }
      if (recordingMode === 'longPress') {
        void sendMessageRef.current?.(transcript, undefined, { forceReadReply: voicePreferences.voiceInputAutoPlay })
      } else {
        setInput((current) => mergeTutorVoiceTranscript(current, transcript))
      }
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : '小迪没有听清楚，请再说一次。',
        variant: 'destructive',
      })
    } finally {
      setTranscribingVoice(false)
      voiceRecordingModeRef.current = 'composer'
      longPressActiveRef.current = false
      longPressReleasePendingRef.current = false
    }
  }, [toast, transcribingVoice, voicePreferences.voiceInputAutoPlay])

  const startVoiceRecording = useCallback(async (mode: TutorVoiceRecordingMode = 'composer') => {
    const resetLongPressState = () => {
      if (mode !== 'longPress') return
      longPressActiveRef.current = false
      longPressReleasePendingRef.current = false
      voiceRecordingModeRef.current = 'composer'
    }

    if (recordingVoice || transcribingVoice) {
      resetLongPressState()
      return
    }
    if (!user) {
      resetLongPressState()
      promptLogin(() => undefined, {
        title: '登录后找小迪',
        description: '登录后即可用语音和小迪对话。',
      })
      return
    }
    if (busyRef.current || (quota != null && !quota.canChat)) {
      resetLongPressState()
      return
    }

    try {
      stopSpeechPlayback()
      voiceRecordingModeRef.current = mode
      const recorder = await createTutorPcmRecorder()
      recorderRef.current = recorder
      setRecordingElapsedMs(0)
      setRecordingStartedAt(Date.now())
      setRecordingVoice(true)
      recordingTimerRef.current = setTimeout(() => {
        void finishVoiceRecording()
      }, TUTOR_VOICE_MAX_RECORDING_MS)
      if (mode === 'longPress' && longPressReleasePendingRef.current) {
        longPressReleasePendingRef.current = false
        void finishVoiceRecording()
      }
    } catch (error) {
      voiceRecordingModeRef.current = 'composer'
      setRecordingStartedAt(null)
      setRecordingElapsedMs(0)
      resetLongPressState()
      toast({
        title: error instanceof Error ? error.message : '无法打开麦克风，请检查浏览器权限。',
        variant: 'destructive',
      })
    }
  }, [finishVoiceRecording, promptLogin, quota, recordingVoice, stopSpeechPlayback, toast, transcribingVoice, user])

  const toggleVoiceRecording = () => {
    if (recordingVoice) {
      void finishVoiceRecording()
    } else {
      void startVoiceRecording('composer')
    }
  }

  const toggleAutoReadReplies = (checked: boolean) => {
    setVoicePreferences((current) => ({ ...current, autoReadReplies: checked }))
    setTutorVoicePreference('autoReadReplies', checked)
  }

  useEffect(() => {
    if (!open) {
      stopSpeechPlayback()
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
      void recorderRef.current?.cancel()
      recorderRef.current = null
      setRecordingVoice(false)
      setRecordingStartedAt(null)
      setRecordingElapsedMs(0)
      longPressActiveRef.current = false
      longPressReleasePendingRef.current = false
    }
  }, [open, stopSpeechPlayback])

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current)
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
      void recorderRef.current?.cancel()
      speechAudioRef.current?.pause()
      if (speechObjectUrlRef.current) URL.revokeObjectURL(speechObjectUrlRef.current)
    }
  }, [])

  useEffect(() => {
    if (busy || view !== 'chat') return
    const pendingText = pendingAutoReadTextRef.current
    if (!pendingText) return
    if (!autoReadReplies && !pendingAutoReadForceRef.current) {
      pendingAutoReadTextRef.current = null
      pendingAutoReadForceRef.current = false
      return
    }
    const lastIndex = messages.length - 1
    const last = messages[lastIndex]
    if (last?.role !== 'assistant' || last.error || last.streaming || last.content !== pendingText) return
    pendingAutoReadTextRef.current = null
    pendingAutoReadForceRef.current = false
    void playSpeech(last.content, `chat-${lastIndex}`)
  }, [autoReadReplies, busy, messages, playSpeech, view])

  useEffect(() => {
    stopSpeechPlayback()
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    void recorderRef.current?.cancel()
    recorderRef.current = null
    setRecordingVoice(false)
    setRecordingStartedAt(null)
    setRecordingElapsedMs(0)
    setTranscribingVoice(false)
    setMascotFeedback(null)
    toolPendingCountRef.current = 0
    setToolPendingCount(0)
    pendingAutoReadTextRef.current = null
    pendingAutoReadForceRef.current = false
    longPressActiveRef.current = false
    longPressReleasePendingRef.current = false
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [contextKey, stopSpeechPlayback])

  const sendMessage = useCallback(
    async (text: string, images?: string[], options: TutorSendMessageOptions = {}) => {
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
      setMascotFeedback(null)
      setGreeting(null)
      setInput('')
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
      setMessages((current) => [
        ...current,
        userMessage,
        { role: 'assistant', content: '', streaming: true },
      ])

      // 用「找最后一条 streaming 占位」代替固定索引，避免 loadSession 等并发更新打乱下标。
      const patchStreaming = (patch: TutorChatMessage) => {
        setMessages((current) => {
          const next = [...current]
          for (let i = next.length - 1; i >= 0; i -= 1) {
            if (next[i].role === 'assistant' && next[i].streaming) {
              next[i] = patch
              return next
            }
          }
          next.push(patch)
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
          if (!dispatchTutorToolCall) return false
          return await dispatchTutorToolCall(toolCall)
        } catch {
          return false
        } finally {
          endToolWork()
        }
      }

      try {
        const res = await fetch('/api/tutor/chat', {
          method: 'POST',
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
          }),
        })
        const responseHeadersMs = TUTOR_CLIENT_TIMING_ENABLED ? markTiming() : 0
        const serverTiming = TUTOR_CLIENT_TIMING_ENABLED ? res.headers.get('Server-Timing') : null

        if (res.status === 402) {
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

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let full = ''
        let streamError: string | null = null
        let streamWarning: string | null = null
        let toolFailed = false
        let sawToolCall = false

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmedLine = line.trim()
            if (!trimmedLine.startsWith('data:')) continue
            const json = trimmedLine.slice(5).trim()
            if (!json) continue
            if (TUTOR_CLIENT_TIMING_ENABLED && firstEventMs == null) {
              firstEventMs = markTiming()
            }
            let event: TutorStreamEvent
            try {
              event = JSON.parse(json)
            } catch {
              continue
            }
            if (event.type === 'chunk' && event.content) {
              if (TUTOR_CLIENT_TIMING_ENABLED && firstChunkMs == null) {
                firstChunkMs = markTiming()
              }
              full += event.content
              patchStreaming({ role: 'assistant', content: full, streaming: true })
            } else if (event.type === 'done' && event.reply) {
              full = event.reply
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
        }

        if (streamError) {
          if (full) {
            // 已有流式内容：保留内容，错误另起一条气泡，不覆盖回复
            patchStreaming({ role: 'assistant', content: full })
            setMessages((current) => [...current, { role: 'assistant', content: streamError, error: true }])
            setMascotFeedback('error')
            void refreshQuota()
            return
          }
          throw new Error(streamError)
        }

        const assistantMessage: TutorChatMessage = { role: 'assistant', content: full || '…' }
        const willAutoRead =
          (autoReadReplies || options.forceReadReply) && !assistantMessage.error

        if (toolFailed) {
          setMascotFeedback('error')
        } else if (!willAutoRead) {
          // 即将自动朗读时不抢 success，让 speaking 态立刻可见
          setMascotFeedback('success')
        }

        patchStreaming(assistantMessage)
        if (willAutoRead) {
          pendingAutoReadTextRef.current = assistantMessage.content
          pendingAutoReadForceRef.current = options.forceReadReply === true
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
          replyLength: full.length,
          sawToolCall,
          toolFailed,
        })
        void refreshQuota()
      } catch (error) {
        logTiming('error', { error: error instanceof Error ? error.message : String(error) })
        patchStreaming({
          role: 'assistant',
          content: error instanceof Error ? error.message : '小迪暂时不可用，请稍后再试。',
          error: true,
        })
        setMascotFeedback('error')
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [
      user,
      context.contextType,
      context.contextId,
      context.lessonId,
      context.surface,
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
      dispatchTutorToolCall,
      clientToolCapabilities,
      autoReadReplies,
    ],
  )

  useEffect(() => {
    sendMessageRef.current = sendMessage
  }, [sendMessage])

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const handleFabPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (
      open ||
      hideOnMobile ||
      !coarsePointer ||
      !voicePreferences.mobileLongPressInput ||
      event.pointerType === 'mouse' ||
      busyRef.current ||
      recordingVoice ||
      transcribingVoice ||
      (quota != null && !quota.canChat)
    ) {
      return
    }

    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Some browsers may not allow capture after synthetic pointer events.
    }

    clearLongPressTimer()
    longPressActiveRef.current = false
    longPressReleasePendingRef.current = false
    longPressTimerRef.current = setTimeout(() => {
      suppressNextToggleRef.current = true
      longPressActiveRef.current = true
      setShowVoiceHint(false)
      void startVoiceRecording('longPress')
    }, TUTOR_LONG_PRESS_RECORDING_MS)
  }

  const handleFabPointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    clearLongPressTimer()

    if (!longPressActiveRef.current) return

    event.preventDefault()
    suppressNextToggleRef.current = true
    longPressActiveRef.current = false
    if (recorderRef.current) {
      void finishVoiceRecording()
    } else {
      longPressReleasePendingRef.current = true
    }
  }

  const handleFabClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (suppressNextToggleRef.current) {
      suppressNextToggleRef.current = false
      event.preventDefault()
      event.stopPropagation()
      return
    }
    onToggle()
  }

  // 输入框/发送按钮共用：携带待发图片，确认会发送后再清空，避免被 guard 拦截时丢图。
  const submitComposer = () => {
    if (busyRef.current || uploadingImage || recordingVoice || transcribingVoice) return
    if (quota != null && !quota.canChat) return
    const text = input
    const images = pendingImages
    if (!text.trim() && images.length === 0) return
    setPendingImages([])
    void sendMessage(text, images)
  }

  const resizeComposer = useCallback(() => {
    const el = composerTextareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, COMPOSER_MIN_HEIGHT_PX), COMPOSER_MAX_HEIGHT_PX)}px`
  }, [])

  useEffect(() => {
    resizeComposer()
  }, [input, resizeComposer])

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submitComposer()
    }
  }

  const handleFilePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'))
    event.target.value = ''
    if (files.length === 0) return

    const room = MAX_CHAT_IMAGES - pendingImages.length
    if (room <= 0) {
      toast({ title: `一次最多发 ${MAX_CHAT_IMAGES} 张图片`, variant: 'destructive' })
      return
    }

    setUploadingImage(true)
    try {
      for (const file of files.slice(0, room)) {
        try {
          const url = await uploadFileSecure(file, 'project-images', 'tutor-chat')
          if (url) {
            setPendingImages((current) => (current.includes(url) ? current : [...current, url]))
          }
        } catch (error) {
          const uploadToast = getTutorUploadToast(error)
          toast({ ...uploadToast, variant: 'destructive' })
          setMascotFeedback('error')
        }
      }
    } finally {
      setUploadingImage(false)
    }
  }

  const addSuggestedImage = (url: string) => {
    if (pendingImages.includes(url)) return
    if (pendingImages.length >= MAX_CHAT_IMAGES) {
      toast({ title: `一次最多发 ${MAX_CHAT_IMAGES} 张图片`, variant: 'destructive' })
      return
    }
    setPendingImages((current) =>
      current.includes(url) || current.length >= MAX_CHAT_IMAGES ? current : [...current, url],
    )
  }

  const removePendingImage = (url: string) => {
    setPendingImages((current) => current.filter((item) => item !== url))
  }

  const startNewTopic = async () => {
    try {
      await fetch(`/api/tutor/chat?${buildParams()}`, { method: 'DELETE' })
    } catch {
      // ignore
    }
    setView('chat')
    setHistoryItems(null)
    setHistoryDetail(null)
    setMessages([])
    setGreeting(null)
    void loadSession()
  }

  const openHistory = async () => {
    if (!user) {
      promptLogin(() => undefined, {
        title: '登录后找小迪',
        description: '登录后即可查看和小迪的历史对话。',
      })
      return
    }
    const requestKey = contextKeyRef.current
    setView('history')
    setHistoryDetail(null)
    setHistoryLoading(true)
    try {
      const params = new URLSearchParams({
        contextType: context.contextType,
        contextId: context.contextId,
      })
      const res = await fetch(`/api/tutor/conversations?${params}`)
      if (!res.ok) throw new Error()
      const payload = await res.json()
      if (contextKeyRef.current !== requestKey) return
      setHistoryItems(Array.isArray(payload.conversations) ? payload.conversations : [])
    } catch {
      if (contextKeyRef.current !== requestKey) return
      setHistoryItems([])
      toast({ title: '历史对话加载失败，请稍后再试', variant: 'destructive' })
    } finally {
      setHistoryLoading(false)
    }
  }

  const openHistoryDetail = async (item: TutorHistoryItem) => {
    const requestKey = contextKeyRef.current
    setView('historyDetail')
    setHistoryDetail({ id: item.id, title: item.title, archivedAt: item.archivedAt, messages: [] })
    setHistoryDetailLoading(true)
    try {
      const res = await fetch(`/api/tutor/conversations/${item.id}`)
      if (!res.ok) throw new Error()
      const payload = await res.json()
      if (contextKeyRef.current !== requestKey) return
      setHistoryDetail({
        id: item.id,
        title: payload.conversation?.title ?? item.title,
        archivedAt: payload.conversation?.archivedAt ?? item.archivedAt,
        messages: Array.isArray(payload.messages) ? payload.messages : [],
      })
    } catch {
      if (contextKeyRef.current !== requestKey) return
      setView('history')
      setHistoryDetail(null)
      toast({ title: '这条历史对话打开失败，请稍后再试', variant: 'destructive' })
    } finally {
      setHistoryDetailLoading(false)
    }
  }

  const deleteHistoryConversation = async (
    conversation: Pick<TutorHistoryItem, 'id' | 'title'>,
    event?: MouseEvent<HTMLButtonElement>,
  ) => {
    event?.preventDefault()
    event?.stopPropagation()
    if (deletingHistoryId) return

    const title = conversation.title || '这条历史对话'
    if (!window.confirm(`确定删除「${title}」吗？删除后不能恢复。`)) return

    const requestKey = contextKeyRef.current
    setDeletingHistoryId(conversation.id)
    try {
      const res = await fetch(`/api/tutor/conversations/${conversation.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: unknown } | null
        throw new Error(typeof payload?.error === 'string' ? payload.error : '请稍后再试')
      }
      if (contextKeyRef.current !== requestKey) return
      setHistoryItems((current) => current?.filter((item) => item.id !== conversation.id) ?? current)
      setHistoryDetail((current) => (current?.id === conversation.id ? null : current))
      if (view === 'historyDetail' && historyDetail?.id === conversation.id) {
        setView('history')
      }
      toast({ title: '历史对话已删除' })
    } catch (error) {
      if (contextKeyRef.current !== requestKey) return
      toast({
        title: '历史对话删除失败',
        description: error instanceof Error ? error.message : '请稍后再试',
        variant: 'destructive',
      })
    } finally {
      setDeletingHistoryId((current) => (current === conversation.id ? null : current))
    }
  }

  const exitHistory = () => {
    if (view === 'historyDetail') {
      setView('history')
      setHistoryDetail(null)
    } else {
      setView('chat')
    }
  }

  const panelSubtitle = subtitle || (sceneTitle ? `正在陪你：${sceneTitle}` : '你的 STEAM 学习伙伴')
  const lastMessage = messages[messages.length - 1]
  const mascotState = resolveTutorMascotState({
    recording: recordingVoice,
    feedback: mascotFeedback,
    working: toolPendingCount > 0 || uploadingImage,
    speaking: Boolean(
      playingSpeechKey || (lastMessage?.role === 'assistant' && lastMessage.streaming && lastMessage.content),
    ),
    thinking: busy || transcribingVoice || sessionQuery.isFetching,
  })
  const handleMascotCycleEnd = useCallback((state: XiaoDiState) => {
    if (state !== 'success' && state !== 'error') return
    setMascotFeedback((current) => (current === state ? null : current))
  }, [])
  const activeVoiceFeedback: TutorVoiceFeedback | null = recordingVoice
    ? {
        tone: 'recording',
        title: voiceRecordingModeRef.current === 'longPress' ? '正在听，松开后发送' : '小迪正在听',
        detail: voiceRecordingModeRef.current === 'longPress' ? '保持说话' : '点方块结束录音',
        elapsedMs: recordingElapsedMs,
      }
    : transcribingVoice
      ? {
          tone: 'processing',
          title: '正在识别语音',
          detail: voiceRecordingModeRef.current === 'longPress' ? '识别后自动发送' : '把语音转成文字',
        }
      : speechLoadingKey
        ? {
            tone: 'processing',
            title: '正在准备朗读',
            detail: '生成小迪的声音',
            canStopSpeech: true,
          }
        : playingSpeechKey
          ? {
              tone: 'speaking',
              title: '小迪正在说',
              detail: '回复播放中',
              canStopSpeech: true,
            }
          : null

  if (!mounted) return null

  return createPortal(
    <>
      {open && (
        <section
          className={cn(
            'fixed right-4 z-50 flex w-[min(92vw,380px)] flex-col overflow-hidden rounded-(--radius-lg) border border-[hsl(var(--brand-blue)/0.3)] bg-[hsl(var(--surface-raised))] shadow-[0_24px_60px_-20px_hsl(var(--surface-shadow)/0.55)] md:right-6',
            hideOnMobile && 'max-lg:hidden',
            fabPlacement === 'compact'
              ? 'bottom-[calc(5rem+env(safe-area-inset-bottom))] max-h-[calc(100dvh_-_6rem_-_env(safe-area-inset-bottom))] md:bottom-42 md:max-h-[calc(100dvh_-_11.5rem)]'
              : 'bottom-[calc(12rem+env(safe-area-inset-bottom))] max-h-[calc(100dvh_-_13rem_-_env(safe-area-inset-bottom))] md:bottom-24 md:max-h-[calc(100dvh_-_7rem)]',
          )}
        >
          <div className="flex items-center gap-3 border-b border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--status-info-surface)/0.5)] px-3.5 py-3">
            <span className="relative h-11 w-10 shrink-0 overflow-visible drop-shadow-[0_8px_12px_hsl(var(--brand-blue)/0.18)]">
              <span className="absolute left-1/2 top-1/2 flex h-[52px] w-[52px] -translate-x-1/2 -translate-y-1/2 items-center justify-center">
                <XiaoDi state={mascotState} size={52} onCycleEnd={handleMascotCycleEnd} />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
                小迪 · AI 学习导师
                <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--brand-blue))]" />
              </div>
              <p className="truncate text-[11px] text-muted-foreground">{panelSubtitle}</p>
              {quota ? (
                <p className="text-[10px] text-[hsl(var(--brand-blue)/0.85)]">{formatQuota(quota)}</p>
              ) : null}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="更多"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[hsl(var(--surface-muted))]"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void startNewTopic()}>
                  <MessageSquarePlus className="mr-2 h-4 w-4" />
                  开启新对话
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void openHistory()}>
                  <History className="mr-2 h-4 w-4" />
                  历史对话
                </DropdownMenuItem>
                <DropdownMenuCheckboxItem
                  checked={autoReadReplies}
                  onCheckedChange={(checked) => toggleAutoReadReplies(checked === true)}
                >
                  <Volume2 className="mr-2 h-4 w-4" />
                  自动朗读新回复
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={onToggle}
              aria-label="收起导师"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[hsl(var(--surface-muted))]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {view !== 'chat' && (
            <div className="flex items-center gap-2 border-b border-[hsl(var(--brand-blue)/0.12)] bg-[hsl(var(--surface-raised)/0.8)] px-3.5 py-2">
              <button
                type="button"
                onClick={exitHistory}
                aria-label={view === 'historyDetail' ? '返回历史列表' : '返回当前对话'}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[hsl(var(--surface-muted))]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <span className="truncate text-xs font-semibold text-foreground/85">
                {view === 'historyDetail' ? historyDetail?.title || '历史对话' : '历史对话'}
              </span>
              {view === 'historyDetail' && historyDetail?.archivedAt ? (
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(historyDetail.archivedAt), { addSuffix: true, locale: zhCN })}归档
                </span>
              ) : null}
            </div>
          )}

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 py-4">
            {view === 'history' && (
              <>
                {historyLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((item) => (
                      <div key={item} className="h-14 animate-pulse rounded-sm bg-muted" />
                    ))}
                  </div>
                ) : !historyItems || historyItems.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    这个场景还没有历史对话。点「开启新对话」后，旧对话会出现在这里。
                  </p>
                ) : (
                  historyItems.map((item) => {
                    const deleting = deletingHistoryId === item.id
                    return (
                      <div
                        key={item.id}
                        className="group flex items-stretch overflow-hidden rounded-sm border border-[hsl(var(--brand-blue)/0.15)] bg-[hsl(var(--surface-raised))] transition-colors hover:bg-[hsl(var(--status-info-surface)/0.4)]"
                      >
                        <button
                          type="button"
                          onClick={() => void openHistoryDetail(item)}
                          disabled={deleting}
                          className="min-w-0 flex-1 px-3 py-2.5 text-left disabled:cursor-wait disabled:opacity-60"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-[13px] font-medium text-foreground">{item.title}</p>
                            {item.archivedAt ? (
                              <span className="shrink-0 text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(item.archivedAt), { addSuffix: true, locale: zhCN })}
                              </span>
                            ) : null}
                          </div>
                          {item.preview ? (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.preview}</p>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          onClick={(event) => void deleteHistoryConversation(item, event)}
                          disabled={deleting || deletingHistoryId !== null}
                          aria-label={`删除历史对话：${item.title}`}
                          title="删除这条历史对话"
                          className="my-1.5 mr-1.5 inline-flex w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[hsl(var(--status-danger-surface)/0.78)] hover:text-[hsl(var(--status-danger))] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[hsl(var(--status-danger)/0.25)] disabled:cursor-wait disabled:opacity-55"
                        >
                          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    )
                  })
                )}
              </>
            )}

            {view === 'historyDetail' && (
              <>
                {historyDetailLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : historyDetail && historyDetail.messages.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">这条对话没有消息。</p>
                ) : (
                  historyDetail?.messages.map((message, i) => {
                    const speechKey = `history-${i}`
                    return message.role === 'assistant' ? (
                      <TutorBubble
                        key={i}
                        action={
                          message.content ? (
                            <TutorSpeechButton
                              content={message.content}
                              speechKey={speechKey}
                              loading={speechLoadingKey === speechKey}
                              playing={playingSpeechKey === speechKey}
                              onPlay={playSpeech}
                            />
                          ) : null
                        }
                      >
                        <TutorMessageContent content={message.content} allowAudio={allowAudioMessages} />
                      </TutorBubble>
                    ) : (
                      <UserBubble key={i} message={message} />
                    )
                  })
                )}
              </>
            )}

            {view === 'chat' && !user && (
              <TutorBubble>
                你好呀！我是小迪 👋 STEAM 探索的 AI 学习导师。登录后我就能记住你的进度，陪你做项目、聊挑战、认自然～
              </TutorBubble>
            )}
            {view === 'chat' && user && messages.length === 0 && !greeting && sessionQuery.isFetching && (
              <TutorBubble>
                <span className="text-muted-foreground">小迪正在准备这个场景…</span>
              </TutorBubble>
            )}
            {view === 'chat' && user && messages.length === 0 && !greeting && sessionQuery.isError && (
              <TutorBubble error>小迪场景加载失败，可以直接提问，我会在发送时重新连接。</TutorBubble>
            )}
            {view === 'chat' && messages.length === 0 && greeting && (
              <>
                <TutorBubble>{greeting.message}</TutorBubble>
                {user && context.contextType === 'challenge' && stageIndex != null && (
                  <div>
                    <button
                      type="button"
                      onClick={() => void sendMessage(buildStartStagePrompt(stageTitle || '当前阶段'))}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--brand-blue))] px-3.5 py-1.5 text-xs font-semibold text-[hsl(var(--brand-blue-foreground))] shadow-xs transition-transform hover:scale-[1.03] disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      带我开始这一步
                    </button>
                  </div>
                )}
                {user && (quickPrompts.length > 0 || greeting.quickPrompts.length > 0) && (
                  <div className="flex flex-wrap gap-2">
                    {(quickPrompts.length > 0 ? quickPrompts : greeting.quickPrompts).map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void sendMessage(prompt)}
                        disabled={busy}
                        className="rounded-full border border-[hsl(var(--brand-blue)/0.3)] bg-[hsl(var(--surface-raised))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--brand-blue))] transition-colors hover:bg-[hsl(var(--status-info-surface)/0.6)] disabled:opacity-50"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {view === 'chat' &&
              messages.map((message, i) => {
                const speechKey = `chat-${i}`
                return message.role === 'assistant' ? (
                  <TutorBubble
                    key={i}
                    error={message.error}
                    action={
                      message.content && !message.error && !message.streaming ? (
                        <TutorSpeechButton
                          content={message.content}
                          speechKey={speechKey}
                          loading={speechLoadingKey === speechKey}
                          playing={playingSpeechKey === speechKey}
                          onPlay={playSpeech}
                        />
                      ) : null
                    }
                  >
                    {message.content ? (
                      message.error ? (
                        message.content
                      ) : (
                        <TutorMessageContent content={message.content} allowAudio={allowAudioMessages} />
                      )
                    ) : null}
                    {message.streaming && !message.content ? (
                      <ThinkingIndicator />
                    ) : null}
                  </TutorBubble>
                ) : (
                  <UserBubble key={i} message={message} />
                )
              })}

            {view === 'chat' && busy && messages[messages.length - 1]?.role !== 'assistant' && (
              <TutorBubble>
                <ThinkingIndicator />
              </TutorBubble>
            )}

            {view === 'chat' && quota && !quota.canChat && (
              <div className="rounded-sm border border-[hsl(var(--brand-blue)/0.25)] bg-[hsl(var(--status-info-surface)/0.35)] p-3 text-xs leading-5 text-foreground/85">
                今日免费次数或本月代币已用完。开通会员每月可获 {MEMBER_AI_MONTHLY_CREDITS} 代币，绝大多数时间够用～
              </div>
            )}
          </div>

          {view !== 'chat' ? (
            <div className="flex items-center justify-between gap-2 border-t border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--surface-raised)/0.7)] px-3.5 py-3">
              <p className="text-xs text-muted-foreground">
                {view === 'historyDetail' ? '历史对话仅可回看' : '点击一条历史对话即可回看'}
              </p>
              <div className="flex shrink-0 items-center gap-1.5">
                {view === 'historyDetail' && historyDetail ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={(event) =>
                      void deleteHistoryConversation(
                        { id: historyDetail.id, title: historyDetail.title },
                        event,
                      )
                    }
                    disabled={deletingHistoryId !== null}
                    className="px-2 text-[hsl(var(--status-danger))] hover:bg-[hsl(var(--status-danger-surface)/0.78)] hover:text-[hsl(var(--status-danger))]"
                  >
                    {deletingHistoryId === historyDetail.id ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    删除
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setView('chat')
                    setHistoryDetail(null)
                  }}
                >
                  返回当前对话
                </Button>
              </div>
            </div>
          ) : user ? (
            <div className="space-y-2 border-t border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--surface-raised)/0.82)] px-3.5 py-3 shadow-[inset_0_1px_0_hsl(var(--brand-blue-foreground)/0.5)]">
              {pendingImages.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {pendingImages.map((image) => (
                    <span key={image} className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xs bg-muted">
                      <OptimizedImage src={image} alt="待发图片" fill variant="thumbnail" className="object-cover" />
                      <button
                        type="button"
                        onClick={() => removePendingImage(image)}
                        aria-label="移除图片"
                        className="absolute right-0 top-0 inline-flex h-4 w-4 items-center justify-center rounded-bl-xs bg-black/55 text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <span className="text-[10px] text-muted-foreground">带图提问消耗 {AI_CREDIT_COST_VISION} 代币</span>
                </div>
              )}
              {suggestedImages.some((image) => !pendingImages.includes(image)) && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  <span className="shrink-0 text-[10px] text-muted-foreground">发我的照片：</span>
                  {suggestedImages
                    .filter((image) => !pendingImages.includes(image))
                    .map((image) => (
                      <button
                        key={image}
                        type="button"
                        onClick={() => addSuggestedImage(image)}
                        disabled={busy}
                        aria-label="把这张照片发给小迪"
                        className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xs bg-muted ring-1 ring-[hsl(var(--brand-blue)/0.2)] transition-transform hover:scale-105 disabled:opacity-50"
                      >
                        <OptimizedImage src={image} alt="场景照片" fill variant="thumbnail" className="object-cover" />
                      </button>
                    ))}
                </div>
              )}
              {activeVoiceFeedback ? (
                <VoiceFeedbackBar feedback={activeVoiceFeedback} onStopSpeech={stopSpeechPlayback} />
              ) : null}
              <div className="rounded-md border border-[hsl(var(--brand-blue)/0.2)] bg-[hsl(var(--background)/0.86)] px-2.5 pb-2 pt-2.5 shadow-[0_18px_38px_-30px_hsl(var(--brand-blue)/0.8),inset_0_1px_0_hsl(var(--brand-blue-foreground)/0.52)] transition-[border-color,box-shadow] focus-within:border-[hsl(var(--brand-blue)/0.48)] focus-within:shadow-[0_0_0_3px_hsl(var(--brand-blue)/0.11),0_20px_42px_-32px_hsl(var(--brand-blue)/0.86)]">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  hidden
                  onChange={(e) => void handleFilePick(e)}
                />
                <textarea
                  ref={composerTextareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder={recordingVoice ? '小迪正在听…' : transcribingVoice ? '小迪正在整理语音…' : '问小迪一个问题…'}
                  className="min-h-9 max-h-[128px] w-full resize-none border-0 bg-transparent px-1.5 py-1 text-sm leading-5 text-foreground outline-hidden placeholder:text-muted-foreground/55 focus-visible:outline-hidden disabled:bg-transparent disabled:opacity-50"
                  disabled={busy || recordingVoice || transcribingVoice || (quota != null && !quota.canChat)}
                />
                <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy || uploadingImage || pendingImages.length >= MAX_CHAT_IMAGES || (quota != null && !quota.canChat)}
                    aria-label="发图片给小迪"
                    title="发图片给小迪"
                    className={composerToolButtonClass}
                  >
                    {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" strokeWidth={2} />}
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={toggleVoiceRecording}
                      disabled={
                        transcribingVoice ||
                        (!recordingVoice && (busy || uploadingImage || (quota != null && !quota.canChat)))
                      }
                      aria-label={recordingVoice ? '停止语音输入' : '语音输入'}
                      title={recordingVoice ? '停止语音输入' : '语音输入'}
                      className={cn(
                        composerToolButtonClass,
                        recordingVoice && 'border-[hsl(var(--status-danger)/0.35)] bg-[hsl(var(--status-danger-surface)/0.72)] text-[hsl(var(--status-danger))] shadow-[0_10px_20px_-16px_hsl(var(--status-danger)/0.9)]',
                      )}
                    >
                      {transcribingVoice ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : recordingVoice ? (
                        <Square className="h-3.5 w-3.5 fill-current" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </button>
                    <Button
                      type="button"
                      size="icon"
                      shape="pill"
                      onClick={submitComposer}
                      disabled={busy || uploadingImage || recordingVoice || transcribingVoice || (!input.trim() && pendingImages.length === 0) || (quota != null && !quota.canChat)}
                      aria-label="发送"
                      title="发送"
                      className={composerSendButtonClass}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              {showReviewAction && onReview ? (
                <button
                  type="button"
                  onClick={onReview}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--brand-blue))] hover:underline"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  让导师看看我现在这步的产出
                </button>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col items-start gap-2 border-t border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--surface-raised)/0.7)] px-3.5 py-3">
              <p className="text-xs text-muted-foreground">登录后就能和小迪一对一聊。</p>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  promptLogin(() => undefined, {
                    title: '登录后找小迪',
                    description: '登录后即可和 AI 导师小迪聊天。',
                  })
                }
              >
                登录后提问
              </Button>
            </div>
          )}
        </section>
      )}

      {!open && activeVoiceFeedback && (
        <div
          className={cn(
            'fixed right-3 z-50 w-[min(82vw,18rem)] md:hidden',
            hideOnMobile && 'hidden',
            fabPlacement === 'compact'
              ? 'bottom-[calc(6.5rem+env(safe-area-inset-bottom))]'
              : 'bottom-[calc(13.85rem+env(safe-area-inset-bottom))]',
          )}
        >
          <VoiceFeedbackBar feedback={activeVoiceFeedback} compact onStopSpeech={stopSpeechPlayback} />
          <span
            aria-hidden
            className="absolute -bottom-1.5 right-10 h-3 w-3 rotate-45 border-b border-r border-[hsl(var(--brand-blue)/0.22)] bg-[hsl(var(--surface-raised))]"
          />
        </div>
      )}

      {!open && !activeVoiceFeedback && showVoiceHint && voicePreferences.mobileLongPressInput && (
        <div
          role="status"
          className={cn(
            'fixed right-3 z-50 max-w-46 rounded-sm border border-[hsl(var(--brand-blue)/0.22)] bg-[hsl(var(--surface-raised))] px-3 py-2 text-xs font-medium leading-5 text-foreground/86 shadow-[0_16px_34px_-18px_hsl(var(--surface-shadow)/0.55)] md:hidden',
            hideOnMobile && 'hidden',
            fabPlacement === 'compact'
              ? 'bottom-[calc(6.5rem+env(safe-area-inset-bottom))]'
              : 'bottom-[calc(13.85rem+env(safe-area-inset-bottom))]',
          )}
        >
          长按小迪直接说话
          <span
            aria-hidden
            className="absolute -bottom-1.5 right-10 h-3 w-3 rotate-45 border-b border-r border-[hsl(var(--brand-blue)/0.22)] bg-[hsl(var(--surface-raised))]"
          />
        </div>
      )}

      <button
        type="button"
        onClick={handleFabClick}
        onPointerDown={handleFabPointerDown}
        onPointerUp={handleFabPointerEnd}
        onPointerCancel={handleFabPointerEnd}
        aria-label={open ? '收起 AI 导师' : '打开 AI 导师'}
        className={cn(
          'fixed right-4 z-50 inline-flex touch-none select-none items-center justify-center transition-transform hover:scale-105 active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-blue)/0.45)] focus-visible:ring-offset-2 md:right-6',
          open
            ? 'h-12 w-12 rounded-full bg-[hsl(var(--surface-raised))] shadow-[0_16px_36px_-12px_hsl(var(--brand-blue)/0.6)] ring-1 ring-[hsl(var(--brand-blue)/0.28)]'
            : 'h-20 w-20 bg-transparent drop-shadow-[0_18px_18px_hsl(var(--brand-blue)/0.28)]',
          hideOnMobile && 'max-lg:hidden',
          fabPlacement === 'compact'
            ? 'bottom-[calc(1rem+env(safe-area-inset-bottom))] md:bottom-24'
            : 'bottom-[calc(8.5rem+env(safe-area-inset-bottom))] md:bottom-6',
        )}
      >
        {open ? (
          <ChevronDown className="h-6 w-6 text-[hsl(var(--brand-blue))]" />
        ) : (
          <>
            <span className="flex h-full w-full items-center justify-center overflow-visible">
              <XiaoDi state={mascotState} size={86} onCycleEnd={handleMascotCycleEnd} />
            </span>
          </>
        )}
      </button>
    </>,
    document.body,
  )
}

function VoiceFeedbackBar({
  feedback,
  compact = false,
  onStopSpeech,
}: {
  feedback: TutorVoiceFeedback
  compact?: boolean
  onStopSpeech?: () => void
}) {
  const isRecording = feedback.tone === 'recording'
  const isProcessing = feedback.tone === 'processing'

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-sm border px-3 py-2 text-xs shadow-[0_14px_30px_-24px_hsl(var(--brand-blue)/0.68)]',
        isRecording
          ? 'border-[hsl(var(--status-danger)/0.2)] bg-[hsl(var(--status-danger-surface)/0.62)] text-[hsl(var(--status-danger))]'
          : 'border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--status-info-surface)/0.58)] text-[hsl(var(--brand-blue))]',
        compact && 'shadow-[0_16px_34px_-18px_hsl(var(--surface-shadow)/0.55)]',
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isRecording
            ? 'bg-[hsl(var(--status-danger)/0.12)]'
            : 'bg-[hsl(var(--brand-blue)/0.12)]',
        )}
        aria-hidden
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <VoiceWave tone={isRecording ? 'recording' : 'speaking'} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold leading-4 text-foreground/88">
          {feedback.title}
        </span>
        <span className="block truncate text-[10px] leading-4 text-muted-foreground">
          {feedback.detail}
        </span>
      </span>
      {feedback.elapsedMs != null ? (
        <span className="shrink-0 rounded-full bg-[hsl(var(--surface-raised)/0.86)] px-2 py-0.5 font-mono text-[10px] text-foreground/72">
          {formatVoiceElapsed(feedback.elapsedMs)}
        </span>
      ) : null}
      {feedback.canStopSpeech && onStopSpeech ? (
        <button
          type="button"
          onClick={onStopSpeech}
          aria-label="停止朗读"
          title="停止朗读"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--surface-raised)/0.9)] text-[hsl(var(--brand-blue))] transition-colors hover:bg-[hsl(var(--surface-raised))] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-blue)/0.28)]"
        >
          <VolumeX className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )
}

function VoiceWave({ tone }: { tone: 'recording' | 'speaking' }) {
  return (
    <span className="flex h-4 items-center gap-0.5" aria-hidden>
      {VOICE_WAVE_BARS.map((height, index) => (
        <span
          key={`${height}-${index}`}
          className={cn(
            'w-0.5 rounded-full opacity-80 motion-safe:animate-pulse',
            tone === 'recording'
              ? 'bg-[hsl(var(--status-danger))]'
              : 'bg-[hsl(var(--brand-blue))]',
          )}
          style={{
            height,
            animationDelay: `${index * 110}ms`,
            animationDuration: '900ms',
          }}
        />
      ))}
    </span>
  )
}

function UserBubble({ message }: { message: TutorChatMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] space-y-1.5">
        {message.content ? (
          <div className="whitespace-pre-wrap rounded-sm rounded-tr-sm bg-[hsl(var(--brand-blue))] px-3 py-2 text-[13px] leading-6 text-[hsl(var(--brand-blue-foreground))]">
            {message.content}
          </div>
        ) : null}
        {message.images && message.images.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {message.images.map((image, idx) => (
              <span key={idx} className="relative h-12 w-12 overflow-hidden rounded-xs bg-muted">
                <OptimizedImage src={image} alt="产出图" fill variant="thumbnail" className="object-cover" />
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ThinkingIndicator() {
  return (
    <span className="text-muted-foreground">小迪正在思考…</span>
  )
}

function TutorSpeechButton({
  content,
  speechKey,
  loading,
  playing,
  onPlay,
}: {
  content: string
  speechKey: string
  loading: boolean
  playing: boolean
  onPlay: (content: string, speechKey: string) => void | Promise<void>
}) {
  return (
    <button
      type="button"
      onClick={() => void onPlay(content, speechKey)}
      disabled={loading}
      aria-label={playing ? '停止朗读' : '朗读这条回复'}
      title={playing ? '停止朗读' : '朗读这条回复'}
      className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--surface-raised))] text-[hsl(var(--brand-blue))] transition-colors hover:bg-[hsl(var(--status-info-surface)/0.55)] disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : playing ? (
        <VolumeX className="h-3.5 w-3.5" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

function TutorBubble({ children, error, action }: { children: ReactNode; error?: boolean; action?: ReactNode }) {
  return (
    <div className="flex items-start gap-1.5">
      <div
        className={cn(
          'max-w-[80%] whitespace-pre-wrap rounded-sm rounded-tl-sm px-3 py-2 text-[13px] leading-6',
          error
            ? 'bg-[hsl(var(--status-danger-surface)/0.7)] text-[hsl(var(--status-danger))]'
            : 'bg-[hsl(var(--surface-raised))] text-foreground/88',
        )}
      >
        {children}
      </div>
      {action}
    </div>
  )
}
