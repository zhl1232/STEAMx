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
  Sparkles,
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
import { mergeTutorVoiceTranscript } from '@/components/features/tutor/tutor-voice'
import { VoiceFeedbackBar } from '@/components/features/tutor/tutor-voice-feedback'
import { MAX_CHAT_IMAGES, TutorComposer } from '@/components/features/tutor/tutor-composer'
import { TutorMessageList } from '@/components/features/tutor/tutor-message-list'
import {
  useTutorChatStream,
  type TutorSendMessageFn,
} from '@/components/features/tutor/use-tutor-chat-stream'
import { useTutorFabDrag } from '@/components/features/tutor/use-tutor-fab-drag'
import { useTutorHistory } from '@/components/features/tutor/use-tutor-history'
import { useTutorVoice } from '@/components/features/tutor/use-tutor-voice'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/context/auth-context'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'
import { hasTutorSceneCapability } from '@/lib/ai/tutor/scene-capabilities'
import type { AiCreditStatus, TutorGreeting } from '@/lib/ai/tutor/types'
import type { ResolvedTutorContext } from '@/lib/ai/tutor/resolve-context'
import type { ScratchEditorContext } from '@/lib/courses/scratch-messages'
import { MEMBER_AI_MONTHLY_CREDITS } from '@/lib/membership'
import { SecureUploadError, getSecureUploadErrorMessage, uploadFileSecure } from '@/lib/utils/upload'
import { cn } from '@/lib/utils'

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

/**
 * 小迪悬浮球 + 对话面板的编排组件。
 * 具体职责拆在四个 hook 与两个展示组件里：
 * - useTutorChatStream：消息状态、SSE 流式发送、AbortController、工具调用
 * - useTutorVoice：录音/转写、TTS、语音偏好、长按说话
 * - useTutorHistory：历史列表/详情/删除、开启新对话
 * - useTutorFabDrag：悬浮球拖拽、位置持久化、长按计时仲裁
 * - TutorMessageList / TutorComposer：消息区与输入区展示
 * 这里只保留共享状态（quota、开场白、待发图片、吉祥物）与各模块间的接线。
 */
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
  const queryClient = useQueryClient()

  const [mounted, setMounted] = useState(false)
  const [input, setInput] = useState('')
  const [mascotFeedback, setMascotFeedback] = useState<TutorMascotFeedback | null>(null)
  const [quota, setQuota] = useState<AiCreditStatus | null>(null)
  const [greeting, setGreeting] = useState<TutorGreeting | null>(null)
  const [sceneTitle, setSceneTitle] = useState('')
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const [suggestedImages, setSuggestedImages] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)

  // 发送中标记（ref 版），loadSession 用它避免覆盖乐观插入的消息；由流式控制器维护。
  const busyRef = useRef(false)
  const sendMessageRef = useRef<TutorSendMessageFn | null>(null)

  const contextKey = `${context.contextType}:${context.contextId}:${stageIndex ?? ''}:${context.lessonId ?? ''}:${context.surface ?? ''}:${context.playgroundGameKey ?? ''}`
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

  // ---- 流式对话控制器 ----
  const handleBeforeSend = useCallback(() => {
    setMascotFeedback(null)
    setGreeting(null)
    setInput('')
  }, [])

  const {
    messages,
    setMessages,
    busy,
    toolPendingCount,
    sendMessage,
  } = useTutorChatStream({
    contextKey,
    context,
    stageIndex,
    lessonStepIndex,
    lessonStepCount,
    scratchBlockTargetItemIndex,
    scratchEditorContext,
    clientToolCapabilities,
    dispatchToolCall: tutorCtx?.dispatchToolCall,
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

  // ---- 历史会话控制器 ----
  const handleResetChat = useCallback(() => {
    setMessages([])
    setGreeting(null)
  }, [setMessages])

  const history = useTutorHistory({
    contextKey,
    contextKeyRef,
    contextType: context.contextType,
    contextId: context.contextId,
    buildParams,
    loadSession,
    onResetChat: handleResetChat,
  })
  const { view, historyDetail, deletingHistoryId } = history

  // ---- 悬浮球拖拽 ----
  const drag = useTutorFabDrag({
    open,
    mounted,
    hideOnMobile,
    fabPlacement,
    contextKey,
    onToggle,
    longPress: voice.longPress,
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  // 切换场景（换页面/换阶段）时清空旧话题残留的编排层状态
  useEffect(() => {
    setGreeting(null)
    setSceneTitle('')
    setPendingImages([])
    setSuggestedImages([])
    setMascotFeedback(null)
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
                <DropdownMenuItem onClick={() => void history.startNewTopic()}>
                  <MessageSquarePlus className="mr-2 h-4 w-4" />
                  开启新对话
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void history.openHistory()}>
                  <History className="mr-2 h-4 w-4" />
                  历史对话
                </DropdownMenuItem>
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
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[hsl(var(--surface-muted))]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

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
            messages={messages}
            greeting={greeting}
            busy={busy}
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
              busy={busy}
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
              showReviewAction={showReviewAction}
              onReview={onReview}
            />
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

      {!open && voice.voiceFeedback && (
        <div
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
            className="absolute -bottom-1.5 right-10 h-3 w-3 rotate-45 border-b border-r border-[hsl(var(--brand-blue)/0.22)] bg-[hsl(var(--surface-raised))]"
          />
        </div>
      )}

      {!open && !voice.voiceFeedback && voice.showVoiceHint && voice.voicePreferences.mobileLongPressInput && (
        <div
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
            className="absolute -bottom-1.5 right-10 h-3 w-3 rotate-45 border-b border-r border-[hsl(var(--brand-blue)/0.22)] bg-[hsl(var(--surface-raised))]"
          />
        </div>
      )}

      <button
        type="button"
        onClick={drag.handleFabClick}
        onPointerDown={drag.handleFabPointerDown}
        onPointerMove={drag.handleFabPointerMove}
        onPointerUp={drag.handleFabPointerEnd}
        onPointerCancel={drag.handleFabPointerEnd}
        aria-label={open ? '收起 AI 导师' : '打开 AI 导师'}
        className={cn(
          'fixed right-4 z-50 inline-flex touch-none select-none items-center justify-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-blue)/0.45)] focus-visible:ring-offset-2 md:right-6',
          drag.fabDragging ? 'cursor-grabbing transition-none' : 'cursor-grab transition-transform hover:scale-105 active:scale-95',
          open
            ? 'h-12 w-12 rounded-full bg-[hsl(var(--surface-raised))] shadow-[0_16px_36px_-12px_hsl(var(--brand-blue)/0.6)] ring-1 ring-[hsl(var(--brand-blue)/0.28)]'
            : 'h-20 w-20 bg-transparent drop-shadow-[0_18px_18px_hsl(var(--brand-blue)/0.28)]',
          hideOnMobile && 'max-lg:hidden',
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
          <>
            <span className="flex h-full w-full items-center justify-center overflow-visible">
              <XiaoDi
                state={mascotState}
                size={86}
                animated={mascotState !== 'idle'}
                onCycleEnd={handleMascotCycleEnd}
              />
            </span>
          </>
        )}
      </button>
    </>,
    document.body,
  )
}
