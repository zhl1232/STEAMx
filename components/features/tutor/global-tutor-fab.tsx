'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ChevronDown,
  History,
  Loader2,
  MessageSquarePlus,
  MoreHorizontal,
  Trash2,
  Volume2,
  X,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { decideTutorDraft } from './tutor-draft'
import { XiaoDi, type XiaoDiState } from '@/components/features/tutor/xiaodi'
import { TutorFabMascot } from '@/components/features/tutor/tutor-fab-mascot'
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
import { mergeTutorVoiceTranscript } from '@/components/features/tutor/tutor-voice'
import { VoiceFeedbackBar } from '@/components/features/tutor/tutor-voice-feedback'
import { MAX_CHAT_IMAGES, TutorComposer } from '@/components/features/tutor/tutor-composer'
import { TutorMessageList } from '@/components/features/tutor/tutor-message-list'
import {
  useTutorChatStream,
  type TutorSendMessageFn,
} from '@/components/features/tutor/use-tutor-chat-stream'
import { useTutorSheet } from './use-tutor-sheet'
import { TutorMobileSheet, tutorSheetSummary } from './tutor-mobile-sheet'
import type { TutorToolCall } from '@/lib/ai/tutor/tool-calls'
import { useTutorFabDrag } from '@/components/features/tutor/use-tutor-fab-drag'
import { useTutorHistory } from '@/components/features/tutor/use-tutor-history'
import { TutorVoiceSettings } from './tutor-voice-settings'
import { useTutorVoice } from '@/components/features/tutor/use-tutor-voice'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/context/auth-context'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'
import { hasTutorSceneCapability } from '@/lib/ai/tutor/scene-capabilities'
import type { AiCreditStatus, TutorGreeting } from '@/lib/ai/tutor/types'
import { formatTutorQuota } from '@/lib/ai/tutor/billing'
import type { ResolvedTutorContext } from '@/lib/ai/tutor/resolve-context'
import type { ScratchEditorContext } from '@/lib/courses/scratch-messages'
import { SecureUploadError, getSecureUploadErrorMessage, uploadFileSecure } from '@/lib/utils/upload'
import { cn } from '@/lib/utils'

import dockStyles from './tutor-fab-dock.module.css'
import panelStyles from './tutor-panel.module.css'

export type { TutorChatMessage } from '@/components/features/tutor/use-tutor-chat-stream'

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

type TutorPanelProps = {
  loginDraft?: { text: string; userId: string } | null
  onLoginDraftConsumed?: () => void
  onGuestLoginSuccess?: (text: string, userId: string) => void
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
  /** Additional bottom space reserved by the current page's fixed footer. */
  fabBottomInset?: number
}

/**
 * 小迪悬浮球 + 对话面板的编排组件。
 * 具体职责拆在四个 hook 与两个展示组件里：
 * - useTutorChatStream：消息状态、SSE 流式发送、AbortController、工具调用
 * - useTutorVoice：录音/转写、TTS、语音偏好、长按说话
 * - useTutorHistory：历史列表/详情/删除、开启新对话
 * - useTutorFabDrag：悬浮球拖拽、位置持久化、长按计时仲裁、移动端闲置趴边
 * - TutorMessageList / TutorComposer：消息区与输入区展示
 * 这里只保留共享状态（quota、开场白、待发图片、吉祥物）与各模块间的接线。
 */
export function GlobalTutorFab({
  loginDraft,
  onLoginDraftConsumed,
  onGuestLoginSuccess,
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
  fabBottomInset = 0,
}: TutorPanelProps) {
  const { user } = useAuth()
  const { promptLogin, isOpen: loginPromptOpen } = useLoginPrompt()
  const { toast } = useToast()
  const tutorCtx = useOptionalTutorContext()
  const queryClient = useQueryClient()
  const [showVoiceSettings, setShowVoiceSettings] = useState(false)
  const sheet = useTutorSheet(open, fabBottomInset)
  const { collapse } = sheet
  const dispatchToolCall = tutorCtx?.dispatchToolCall
  const handleToolCall = useCallback((toolCall: TutorToolCall) => {
    if (['course.focus_lesson_step', 'course.highlight_scratch_blocks', 'pbl.focus_current_stage', 'playground.hint_minesweeper'].includes(toolCall.name)) collapse()
    return dispatchToolCall?.(toolCall) ?? Promise.resolve(false)
  }, [collapse, dispatchToolCall])

  const [mounted, setMounted] = useState(false)
  const [input, setInput] = useState('')
  useEffect(() => {
    if (!loginDraft || loginDraft.userId !== user?.id) return
    setInput(current => current || loginDraft.text)
    onLoginDraftConsumed?.()
  }, [loginDraft, user?.id, onLoginDraftConsumed])
  const [mascotFeedback, setMascotFeedback] = useState<TutorMascotFeedback | null>(null)
  const [quota, setQuota] = useState<AiCreditStatus | null>(null)
  const [greeting, setGreeting] = useState<TutorGreeting | null>(null)
  const [sceneTitle, setSceneTitle] = useState('')
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const [suggestedImages, setSuggestedImages] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const panelRef = useRef<HTMLElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)
  const toggleRef = useRef(onToggle)
  toggleRef.current = onToggle
  const aliveRef = useRef(true)

  // 发送中标记（ref 版），loadSession 用它避免覆盖乐观插入的消息；由流式控制器维护。
  const busyRef = useRef(false)
  const sendMessageRef = useRef<TutorSendMessageFn | null>(null)

  const contextKey = `${user?.id ?? 'anonymous'}:${context.contextType}:${context.contextId}:${stageIndex ?? ''}:${context.lessonId ?? ''}:${context.surface ?? ''}:${context.playgroundGameKey ?? ''}`
  // 最新场景 key 放 ref，异步响应回来时丢弃过期场景的数据（防快速切换串话题）。
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
      playgroundGameKey: context.playgroundGameKey,
    }
  }, [user?.id, context.contextType, context.contextId, stageIndex, context.lessonId, context.surface, context.playgroundGameKey])

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
      playgroundGameKey: context.playgroundGameKey,
    })
  }, [context.contextType, context.contextId, stageIndex, context.lessonId, context.surface, context.playgroundGameKey])

  const refreshQuota = useCallback(async () => {
    const requestKey = contextKeyRef.current
    try {
      const res = await fetch(`/api/tutor/chat?${buildParams()}&quotaOnly=1`)
      if (!res.ok) return
      const payload = await res.json()
      if (!aliveRef.current || contextKeyRef.current !== requestKey) return
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

  // ---- 语音控制器 ----
  const handleComposerTranscript = useCallback((transcript: string) => {
    setInput((current) => mergeTutorVoiceTranscript(current, transcript))
  }, [])
  const handleLongPressTranscript = useCallback(
    (transcript: string, options: { forceReadReply: boolean }) => {
      void sendMessageRef.current?.(transcript, undefined, { forceReadReply: options.forceReadReply })
    },
    [],
  )

  const voice = useTutorVoice({
    open,
    mounted,
    hideOnMobile,
    contextKey,
    contextKeyRef,
    quota,
    busyRef,
    onComposerTranscript: handleComposerTranscript,
    onLongPressTranscript: handleLongPressTranscript,
  })
  const stopSpeechPlayback = voice.stopSpeechPlayback
  const [showCourseHint, setShowCourseHint] = useState(false)
  useEffect(() => {
    setShowCourseHint(false)
    if (!mounted || open || loginPromptOpen || hideOnMobile || context.surface !== 'courses'
      || voice.voiceFeedback || voice.showVoiceHint || !window.matchMedia('(max-width: 767px)').matches) return
    const key = 'tutor:courses-hint:v1'
    try {
      if (sessionStorage.getItem(key)) return
    } catch { /* The hint also works when browser storage is unavailable. */ }
    let hideTimer: ReturnType<typeof setTimeout> | undefined
    const showTimer = setTimeout(() => {
      try { sessionStorage.setItem(key, '1') } catch { /* Storage is optional. */ }
      setShowCourseHint(true)
      hideTimer = setTimeout(() => setShowCourseHint(false), 8_000)
    }, 800)
    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
    }
  }, [mounted, open, loginPromptOpen, hideOnMobile, context.surface, voice.voiceFeedback, voice.showVoiceHint])

  // ---- 流式对话控制器 ----
  const handleBeforeSend = useCallback(() => {
    stopSpeechPlayback()
    setMascotFeedback(null)
    setGreeting(null)
    setInput('')
  }, [stopSpeechPlayback])

  const {
    messages,
    displayMessages = messages,
    hasCarried = false,
    setMessages,
    busy,
    toolPendingCount,
    sendMessage,
    resetChat,
    stopGeneration,
    streamPhase,
    failedMessage,
    retryLastMessage,
    clearFailedMessage,
  } = useTutorChatStream({
    contextKey,
    epoch: sessionQuery.data?.epoch,
    sceneTitle: sessionQuery.data?.scene?.title,
    context,
    stageIndex,
    lessonStepIndex,
    lessonStepCount,
    scratchBlockTargetItemIndex,
    scratchEditorContext,
    clientToolCapabilities,
    dispatchToolCall: dispatchToolCall ? handleToolCall : undefined,
    sessionInput,
    busyRef,
    autoReadReplies: voice.autoReadReplies,
    beginStreamedSpeech: voice.beginStreamedSpeech,
    pushStreamedPcm: voice.pushStreamedPcm,
    finishStreamedSpeech: voice.finishStreamedSpeech,
    playSpeech: voice.playSpeech,
    setQuota,
    refreshQuota,
    setMascotFeedback,
    onBeforeSend: handleBeforeSend,
    onStopSpeech: voice.stopSpeechPlayback,
  })

  useEffect(() => {
    sendMessageRef.current = sendMessage
  }, [sendMessage])

  const applySessionPayload = useCallback(
    (payload: TutorSessionPayload) => {
      setQuota(payload.quota ?? null)
      setSceneTitle(payload.scene?.title ?? '')
      setSuggestedImages(Array.isArray(payload.scene?.suggestedImages) ? payload.scene.suggestedImages : [])
      // 正在流式发送时不要用 DB 历史覆盖本地乐观消息
      if (!busyRef.current) {
        setMessages((payload.messages ?? []).map((m) => ({ ...m })))
        setGreeting(payload.greeting ?? null)
      }
    },
    [setMessages],
  )

  const loadSession = useCallback(async () => {
    if (!sessionInput || !aliveRef.current) return
    const requestKey = contextKeyRef.current
    try {
      const payload = await queryClient.fetchQuery({
        queryKey: tutorSessionQueryKey(sessionInput),
        queryFn: () => fetchTutorSession(sessionInput),
        staleTime: 0,
      })
      // 响应期间场景已切换：丢弃，避免旧话题数据串进新话题
      if (!aliveRef.current || contextKeyRef.current !== requestKey) return
      applySessionPayload(payload)
    } catch {
      // 网络异常保持本地状态
    }
  }, [applySessionPayload, queryClient, sessionInput])

  // ---- 历史会话控制器 ----
  const handleResetChat = useCallback(() => {
    resetChat()
    stopSpeechPlayback()
    setGreeting(null)
  }, [resetChat, stopSpeechPlayback])

  const history = useTutorHistory({
    contextKey,
    epoch: sessionQuery.data?.epoch,
    contextKeyRef,
    busyRef,
    contextType: context.contextType,
    contextId: context.contextId,
    buildParams,
    loadSession,
    onResetChat: handleResetChat,
  })
  const { view, historyDetail, deletingHistoryId } = history

  useEffect(() => {
    aliveRef.current = true
    setMounted(true)
    return () => { aliveRef.current = false }
  }, [])

  useEffect(() => {
    if (!open || !mounted) return
    const panel = panelRef.current
    if (!panel) return
    const viewport = window.visualViewport
    const updateViewport = () => {
      panel.style.setProperty('--tutor-viewport-height', `${viewport?.height ?? window.innerHeight}px`)
      panel.style.setProperty('--tutor-viewport-top', `${viewport?.offsetTop ?? 0}px`)
      const inputFocused = panel.contains(document.activeElement) &&
        document.activeElement?.matches('textarea, input, [contenteditable="true"]')
      panel.dataset.sheetKeyboard = String(Boolean(viewport && window.innerHeight - viewport.height > 150 && inputFocused))
      panel.style.setProperty('--tutor-viewport-bottom', `${Math.max(0, window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0))}px`)
    }
    updateViewport()
    viewport?.addEventListener('resize', updateViewport)
    viewport?.addEventListener('scroll', updateViewport)
    window.addEventListener('resize', updateViewport)
    panel.addEventListener('focusin', updateViewport)
    panel.addEventListener('focusout', updateViewport)
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const launcher = fabRef.current
    // Focus the dialog on touch screens without opening the software keyboard.
    const frame = requestAnimationFrame(() => panel.focus({ preventScroll: true }))
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      toggleRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      viewport?.removeEventListener('resize', updateViewport)
      viewport?.removeEventListener('scroll', updateViewport)
      window.removeEventListener('resize', updateViewport)
      panel.removeEventListener('focusin', updateViewport)
      panel.removeEventListener('focusout', updateViewport)
      if (previousFocus?.isConnected && previousFocus !== document.body) previousFocus.focus({ preventScroll: true })
      else launcher?.focus({ preventScroll: true })
    }
  }, [open, mounted])

  const draftUserRef = useRef(user?.id)

  // 场景信息随页面刷新，未发草稿仅在身份变化时清空。
  useEffect(() => {
    setGreeting(null)
    setSceneTitle('')
      if (draftUserRef.current != null && draftUserRef.current !== user?.id) {
      setPendingImages([])
      setInput('')
    }
    draftUserRef.current = user?.id
    setSuggestedImages([])
    setMascotFeedback(null)
    setQuota(null)
    setUploadingImage(false)
  }, [contextKey, user?.id])

  useEffect(() => {
    if (!sessionQuery.data) return
    applySessionPayload(sessionQuery.data)
  }, [applySessionPayload, sessionQuery.data])

  useEffect(() => {
    // busy 时不消费，等当前回复结束后 effect 因 busy 变化重跑再发送，避免丢消息。
    if (!open || !user || busy || history.startingNewTopic || !tutorCtx?.pendingSend) return
    const pending = tutorCtx.consumePendingSend()
    if (pending) {
      void sendMessage(pending.text, pending.images)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user, busy, history.startingNewTopic, tutorCtx?.pendingSend])

  useEffect(() => {
    if (!open || !tutorCtx?.pendingDraft) return
    const decision = decideTutorDraft(tutorCtx.pendingDraft, user?.id, context.contextType, context.contextId, input, pendingImages.length)
    tutorCtx.clearPendingDraft()
    if (decision === 'prefill') setInput(tutorCtx.pendingDraft.text)
    if (decision === 'preserve') toast({ title: '已保留当前草稿，请发送或清空文字和照片后再选问题。' })
  }, [open, tutorCtx, user?.id, context.contextType, context.contextId, input, pendingImages.length, toast])

  // 输入框/发送按钮共用：携带待发图片，确认会发送后再清空，避免被 guard 拦截时丢图。
  const submitComposer = () => {
    if (busyRef.current || uploadingImage || voice.recordingVoice || voice.transcribingVoice) return
    if (quota != null && !quota.canChat) return
    const text = input
    const images = pendingImages
    if (!text.trim() && images.length === 0) return
    setPendingImages([])
    void sendMessage(text, images)
  }

  const handleFilesSelected = async (files: File[]) => {
    const requestKey = contextKeyRef.current
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
          if (!aliveRef.current || contextKeyRef.current !== requestKey) return
          if (url) {
            setPendingImages((current) => (current.includes(url) || current.length >= MAX_CHAT_IMAGES ? current : [...current, url]))
          }
        } catch (error) {
          if (!aliveRef.current || contextKeyRef.current !== requestKey) return
          const uploadToast = getTutorUploadToast(error)
          toast({ ...uploadToast, variant: 'destructive' })
          setMascotFeedback('error')
        }
      }
    } finally {
      if (aliveRef.current && contextKeyRef.current === requestKey) setUploadingImage(false)
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

  const panelSubtitle = subtitle || (sceneTitle ? `正在陪你：${sceneTitle}` : '你的 STEAM 学习伙伴')
  const lastMessage = messages[messages.length - 1]
  const mascotState = resolveTutorMascotState({
    recording: voice.recordingVoice,
    feedback: mascotFeedback,
    working: toolPendingCount > 0 || uploadingImage,
    speaking: Boolean(
      voice.playingSpeechKey || (lastMessage?.role === 'assistant' && lastMessage.streaming && lastMessage.content),
    ),
    thinking: busy || voice.transcribingVoice || sessionQuery.isFetching,
  })
  const handleMascotCycleEnd = useCallback((state: XiaoDiState) => {
    if (state !== 'success' && state !== 'error') return
    setMascotFeedback((current) => (current === state ? null : current))
  }, [])

  // Idle docking waits until voice, response and feedback animations have finished.
  const drag = useTutorFabDrag({
    open,
    mounted,
    hideOnMobile,
    fabPlacement,
    contextKey,
    onToggle,
    longPress: voice.longPress,
    recording: voice.recordingVoice || mascotState !== 'idle',
    bottomInset: fabBottomInset,
  })
  const scrollTucked = useScrollTuck(!open)

  if (!mounted) return null

  return createPortal(
    <>
      {open && (
        <section
          ref={panelRef}
          {...sheet.panelProps}
          role="dialog"
          aria-label="小迪 AI 学习导师"
          tabIndex={-1}
          className={cn(
            panelStyles.panel,
            'z-50 flex flex-col overflow-hidden rounded-(--radius-lg) border border-[hsl(var(--brand-blue)/0.3)] bg-[hsl(var(--surface-raised))] shadow-[0_24px_60px_-20px_hsl(var(--surface-shadow)/0.55)] outline-none',
            hideOnMobile && 'max-lg:hidden',
            fabPlacement === 'compact' && panelStyles.compact,
          )}
        >
          <TutorMobileSheet sheet={sheet} summary={tutorSheetSummary(displayMessages)}>
          <div {...sheet.headerProps} className={cn(panelStyles.header, "flex shrink-0 items-center gap-2 border-b border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--status-info-surface)/0.5)] px-3 py-2")}>
            <span className="relative h-11 w-10 shrink-0 overflow-visible drop-shadow-[0_8px_12px_hsl(var(--brand-blue)/0.18)]">
              <span className="absolute left-1/2 top-1/2 flex h-[52px] w-[52px] -translate-x-1/2 -translate-y-1/2 items-center justify-center">
                <XiaoDi state={mascotState} size={52} onCycleEnd={handleMascotCycleEnd} />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold tracking-tight">
                小迪 · AI 学习导师
              </div>
              <p className="truncate text-[11px] text-muted-foreground">{panelSubtitle}</p>
              {quota ? (
                <p className="whitespace-pre-line text-[10px] text-[hsl(var(--brand-blue)/0.85)]">{formatTutorQuota(quota)}</p>
              ) : null}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="更多"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[hsl(var(--surface-muted))] focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-md:z-[52]">
                <DropdownMenuItem disabled={busy || history.startingNewTopic || !user} onClick={() => void history.startNewTopic()}>
                  <MessageSquarePlus className="mr-2 h-4 w-4" />
                  开启新对话
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void history.openHistory()}>
                  <History className="mr-2 h-4 w-4" />
                  历史对话
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!user || busy} onClick={() => setShowVoiceSettings(true)}>朗读声音</DropdownMenuItem>
                <DropdownMenuCheckboxItem
                  checked={voice.autoReadReplies}
                  onCheckedChange={(checked) => voice.toggleAutoReadReplies(checked === true)}
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
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[hsl(var(--surface-muted))] focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {showVoiceSettings && user && <TutorVoiceSettings key={user.id} userId={user.id} onClose={() => setShowVoiceSettings(false)} onPreview={voice.playSpeech} onStop={voice.stopSpeechPlayback} />}

          {view !== 'chat' && (
            <div className="flex items-center gap-2 border-b border-[hsl(var(--brand-blue)/0.12)] bg-[hsl(var(--surface-raised)/0.8)] px-3.5 py-2">
              <button
                type="button"
                onClick={history.exitHistory}
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

          <TutorMessageList
            view={view}
            isAuthenticated={Boolean(user)}
            messages={displayMessages}
            greeting={hasCarried ? null : greeting}
            busy={busy || history.startingNewTopic}
            streamPhase={streamPhase}
            recoveryAction={failedMessage ? {
              label: failedMessage.retryable ? '重试这次提问' : '重新编辑问题',
              onClick: () => {
                if (failedMessage.retryable) void retryLastMessage()
                else {
                  setInput(failedMessage.text)
                  setPendingImages(failedMessage.images ?? [])
                  clearFailedMessage()
                  panelRef.current?.querySelector('textarea')?.focus()
                }
              },
            } : undefined}
            quota={quota}
            sessionFetching={sessionQuery.isFetching}
            sessionError={sessionQuery.isError}
            allowAudioMessages={allowAudioMessages}
            contextType={context.contextType}
            stageIndex={stageIndex}
            stageTitle={stageTitle}
            quickPrompts={quickPrompts}
            speechLoadingKey={voice.speechLoadingKey}
            playingSpeechKey={voice.playingSpeechKey}
            onPlaySpeech={voice.playSpeech}
            onSendPrompt={(text) => void sendMessage(text)}
            historyItems={history.historyItems}
            historyLoading={history.historyLoading}
            historyDetail={historyDetail}
            historyDetailLoading={history.historyDetailLoading}
            deletingHistoryId={deletingHistoryId}
            onOpenHistoryDetail={(item) => void history.openHistoryDetail(item)}
            onDeleteHistoryConversation={(conversation, event) =>
              void history.deleteHistoryConversation(conversation, event)
            }
          />

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
                      void history.deleteHistoryConversation(
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
                <Button type="button" size="sm" variant="outline" onClick={history.closeHistory}>
                  返回当前对话
                </Button>
              </div>
            </div>
          ) : user ? (
            <TutorComposer
              input={input}
              onInputChange={setInput}
              onSubmit={submitComposer}
              busy={busy || history.startingNewTopic}
              uploadingImage={uploadingImage}
              recordingVoice={voice.recordingVoice}
              transcribingVoice={voice.transcribingVoice}
              quotaExhausted={quota != null && !quota.canChat}
              pendingImages={pendingImages}
              suggestedImages={suggestedImages}
              onAddSuggestedImage={addSuggestedImage}
              onRemovePendingImage={removePendingImage}
              onPickFiles={(files) => void handleFilesSelected(files)}
              onToggleVoiceRecording={voice.toggleVoiceRecording}
              voiceFeedback={voice.voiceFeedback}
              onStopSpeech={voice.stopSpeechPlayback}
              onStopGeneration={busy ? stopGeneration : undefined}
              showReviewAction={showReviewAction}
              onReview={onReview}
            />
          ) : (
            <div className="flex shrink-0 flex-col items-start gap-2 border-t border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--surface-raised)/0.7)] px-3.5 py-3">
              <textarea
                aria-label="想问小迪的问题"
                placeholder="先写下问题，登录后可继续编辑和发送"
                value={input}
                onChange={event => setInput(event.target.value)}
                className="min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted-foreground">登录后就能和小迪一对一聊。</p>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  promptLogin(authenticatedUser => onGuestLoginSuccess?.(input, authenticatedUser.id), {
                    title: '登录后找小迪',
                    description: '登录后即可和 AI 导师小迪聊天。',
                  })
                }
              >
                登录后提问
              </Button>
            </div>
          )}
          </TutorMobileSheet>
        </section>
      )}

      {!open && voice.voiceFeedback && (
        <div
          data-tutor-ui
          className={cn(
            'fixed right-3 z-50 w-[min(82vw,18rem)] md:hidden',
            hideOnMobile && 'hidden',
            !drag.useCustomFabPosition &&
              (fabPlacement === 'compact'
                ? 'bottom-[calc(6.5rem+env(safe-area-inset-bottom))]'
                : 'bottom-[calc(13.85rem+env(safe-area-inset-bottom))]'),
          )}
          style={drag.fabBubbleStyle}
        >
          <VoiceFeedbackBar feedback={voice.voiceFeedback} compact onStopSpeech={voice.stopSpeechPlayback} />
          <span
            aria-hidden
            className={cn(
              'absolute -bottom-1.5 h-3 w-3 rotate-45 border-b border-r border-[hsl(var(--brand-blue)/0.22)] bg-[hsl(var(--surface-raised))]',
              drag.fabDocked ? (drag.fabDockEdge === 'left' ? 'left-3' : 'right-3') : 'right-10',
            )}
          />
        </div>
      )}

      {!open && !voice.voiceFeedback && showCourseHint && (
        <button
          data-tutor-ui
          type="button"
          onClick={() => { setShowCourseHint(false); onToggle() }}
          className={cn(
            'fixed right-3 z-50 min-h-11 rounded-sm border border-[hsl(var(--brand-blue)/0.22)] bg-[hsl(var(--surface-raised))] px-3 py-2 text-xs font-medium leading-5 text-foreground shadow-sm md:hidden focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
            hideOnMobile && 'hidden',
            !drag.useCustomFabPosition && 'bottom-[calc(13.85rem+env(safe-area-inset-bottom))]',
          )}
          style={drag.fabBubbleStyle}
        >
          想找哪节课？问我。
        </button>
      )}

      {!open && !voice.voiceFeedback && !showCourseHint && voice.showVoiceHint && voice.voicePreferences.mobileLongPressInput && (
        <div
          data-tutor-ui
          role="status"
          className={cn(
            'fixed right-3 z-50 max-w-46 rounded-sm border border-[hsl(var(--brand-blue)/0.22)] bg-[hsl(var(--surface-raised))] px-3 py-2 text-xs font-medium leading-5 text-foreground/86 shadow-[0_16px_34px_-18px_hsl(var(--surface-shadow)/0.55)] md:hidden',
            hideOnMobile && 'hidden',
            !drag.useCustomFabPosition &&
              (fabPlacement === 'compact'
                ? 'bottom-[calc(6.5rem+env(safe-area-inset-bottom))]'
                : 'bottom-[calc(13.85rem+env(safe-area-inset-bottom))]'),
          )}
          style={drag.fabBubbleStyle}
        >
          长按小迪直接说话
          <span
            aria-hidden
            className={cn(
              'absolute -bottom-1.5 h-3 w-3 rotate-45 border-b border-r border-[hsl(var(--brand-blue)/0.22)] bg-[hsl(var(--surface-raised))]',
              drag.fabDocked ? (drag.fabDockEdge === 'left' ? 'left-3' : 'right-3') : 'right-10',
            )}
          />
        </div>
      )}

      <button
        data-tutor-ui
        ref={fabRef}
        type="button"
        onClick={drag.handleFabClick}
        onPointerDown={drag.handleFabPointerDown}
        onPointerMove={drag.handleFabPointerMove}
        onPointerUp={drag.handleFabPointerEnd}
        onPointerCancel={drag.handleFabPointerEnd}
        aria-label={open ? '收起 AI 导师' : '打开 AI 导师'}
        aria-expanded={open}
        className={cn(
          'fixed right-4 z-50 inline-flex touch-none select-none items-center justify-center overflow-visible focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-blue)/0.45)] focus-visible:ring-offset-2 md:right-6',
          dockStyles.host,
          drag.fabInteracting && dockStyles.dragging,
          drag.fabDragging
            ? cn('cursor-grabbing', dockStyles.dragging)
            : cn(
                'cursor-grab',
                drag.fabEdgeDockEnabled ? dockStyles.motion : 'transition-transform',
                !drag.fabDocked && 'md:hover:scale-105 md:active:scale-95',
              ),
          open
            ? 'max-md:hidden h-12 w-12 rounded-full bg-[hsl(var(--surface-raised))] shadow-[0_16px_36px_-12px_hsl(var(--brand-blue)/0.6)] ring-1 ring-[hsl(var(--brand-blue)/0.28)]'
            : cn(
                'h-20 w-20 bg-transparent',
                drag.fabDocked
                  ? 'drop-shadow-[0_5px_7px_hsl(var(--brand-blue)/0.13)]'
                  : 'drop-shadow-[0_18px_18px_hsl(var(--brand-blue)/0.28)]',
              ),
          hideOnMobile && 'max-lg:hidden',
          // 滚动中缩回屏幕边（只在手机上），用独立的 translate 属性，不影响拖动用的 transform。
          scrollTucked && (drag.fabDockEdge === 'left' ? 'max-md:-translate-x-[60%] max-md:opacity-70' : 'max-md:translate-x-[60%] max-md:opacity-70'),
          !drag.useCustomFabPosition &&
            (fabPlacement === 'compact'
              ? 'bottom-[calc(1rem+env(safe-area-inset-bottom))] md:bottom-24'
              : 'bottom-[calc(8.5rem+env(safe-area-inset-bottom))] md:bottom-6'),
        )}
        style={drag.fabStyle}
      >
        {open ? (
          <ChevronDown className="h-6 w-6 text-[hsl(var(--brand-blue))]" />
        ) : (
          <TutorFabMascot
            state={mascotState}
            docked={drag.fabDocked}
            edge={drag.fabDockEdge}
            edgeDockEnabled={drag.fabEdgeDockEnabled}
            onCycleEnd={handleMascotCycleEnd}
          />
        )}
      </button>
    </>,
    document.body,
  )
}

function useScrollTuck(enabled: boolean) {
  const [tucked, setTucked] = useState(false)
  useEffect(() => {
    if (!enabled) {
      setTucked(false)
      return
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const onScroll = () => {
      setTucked(true)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => setTucked(false), 600)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (timer) clearTimeout(timer)
    }
  }, [enabled])
  return tucked
}
