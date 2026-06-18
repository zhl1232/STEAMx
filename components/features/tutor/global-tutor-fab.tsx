'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ChevronDown,
  History,
  ImagePlus,
  Loader2,
  MessageSquarePlus,
  MoreHorizontal,
  Send,
  Sparkles,
  X,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useOptionalTutorContext } from '@/components/features/tutor/tutor-context'
import {
  buildTutorChatParams,
  fetchTutorSession,
  TUTOR_SESSION_STALE_MS,
  tutorSessionQueryKey,
  type TutorSessionPayload,
  type TutorSessionQueryInput,
} from '@/components/features/tutor/tutor-session'
import { TutorMessageContent } from '@/components/features/tutor/tutor-message-content'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/context/auth-context'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'
import type { AiCreditStatus, TutorGreeting } from '@/lib/ai/tutor/types'
import type { ResolvedTutorContext } from '@/lib/ai/tutor/resolve-context'
import { buildStartStagePrompt } from '@/lib/ai/tutor/greeting'
import type { TutorToolCall } from '@/lib/ai/tutor/tool-calls'
import { AI_CREDIT_COST_VISION, MEMBER_AI_MONTHLY_CREDITS } from '@/lib/membership'
import { uploadFileSecure } from '@/lib/utils/upload'
import { cn } from '@/lib/utils'

const TUTOR_AVATAR = '/ai-tutor-mascot.png'
/** 单条消息最多携带的图片数（与服务端引擎一致） */
const MAX_CHAT_IMAGES = 4

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
}

type TutorPanelProps = {
  open: boolean
  onToggle: () => void
  context: ResolvedTutorContext
  stageIndex?: number
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

export function GlobalTutorFab({
  open,
  onToggle,
  context,
  stageIndex,
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
  const [quota, setQuota] = useState<AiCreditStatus | null>(null)
  const [greeting, setGreeting] = useState<TutorGreeting | null>(null)
  const [sceneTitle, setSceneTitle] = useState('')
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const [suggestedImages, setSuggestedImages] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [view, setView] = useState<TutorPanelView>('chat')
  const [historyItems, setHistoryItems] = useState<TutorHistoryItem[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyDetail, setHistoryDetail] = useState<TutorHistoryDetail | null>(null)
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // 发送中标记（ref 版），loadSession 用它避免覆盖乐观插入的消息。
  const busyRef = useRef(false)

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

  useEffect(() => setMounted(true), [])

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

  const sendMessage = useCallback(
    async (text: string, images?: string[]) => {
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
      setGreeting(null)
      setInput('')
      const userMessage: TutorChatMessage = {
        role: 'user',
        content: trimmed,
        images: images?.length ? images : undefined,
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
            surface: context.surface,
          }),
        })

        if (res.status === 402) {
          const payload = await res.json().catch(() => ({}))
          setQuota((q) => (q ? { ...q, canChat: false } : q))
          patchStreaming({
            role: 'assistant',
            content: payload.error ?? '今日免费次数或本月代币已用完。开通会员每月可获 1500 代币～',
            error: true,
          })
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
            let event: TutorStreamEvent
            try {
              event = JSON.parse(json)
            } catch {
              continue
            }
            if (event.type === 'chunk' && event.content) {
              full += event.content
              patchStreaming({ role: 'assistant', content: full, streaming: true })
            } else if (event.type === 'done' && event.reply) {
              full = event.reply
            } else if (event.type === 'warning') {
              streamWarning = event.warning || null
            } else if (event.type === 'error') {
              streamError = event.error || '小迪暂时不可用'
            } else if (event.type === 'tool_call' && event.toolCall) {
              void dispatchTutorToolCall?.(event.toolCall).catch(() => undefined)
            }
          }
        }

        if (streamError) {
          if (full) {
            // 已有流式内容：保留内容，错误另起一条气泡，不覆盖回复
            patchStreaming({ role: 'assistant', content: full })
            setMessages((current) => [...current, { role: 'assistant', content: streamError, error: true }])
            void refreshQuota()
            return
          }
          throw new Error(streamError)
        }

        const assistantMessage: TutorChatMessage = { role: 'assistant', content: full || '…' }
        patchStreaming(assistantMessage)
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
        void refreshQuota()
      } catch (error) {
        patchStreaming({
          role: 'assistant',
          content: error instanceof Error ? error.message : '小迪暂时不可用，请稍后再试。',
          error: true,
        })
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
      promptLogin,
      queryClient,
      refreshQuota,
      sessionInput,
      toast,
      dispatchTutorToolCall,
    ],
  )

  // 输入框/发送按钮共用：携带待发图片，确认会发送后再清空，避免被 guard 拦截时丢图。
  const submitComposer = () => {
    if (busyRef.current || uploadingImage) return
    if (quota != null && !quota.canChat) return
    const text = input
    const images = pendingImages
    if (!text.trim() && images.length === 0) return
    setPendingImages([])
    void sendMessage(text, images)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
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
        const url = await uploadFileSecure(file, 'project-images', 'tutor-chat')
        if (url) {
          setPendingImages((current) => (current.includes(url) ? current : [...current, url]))
        } else {
          toast({ title: '图片上传失败，请重试', variant: 'destructive' })
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

  const exitHistory = () => {
    if (view === 'historyDetail') {
      setView('history')
      setHistoryDetail(null)
    } else {
      setView('chat')
    }
  }

  const panelSubtitle = subtitle || (sceneTitle ? `正在陪你：${sceneTitle}` : '你的 STEAM 学习伙伴')

  if (!mounted) return null

  return createPortal(
    <>
      {open && (
        <section
          className={cn(
            'fixed right-4 z-50 flex w-[min(92vw,380px)] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[hsl(var(--brand-blue)/0.3)] bg-[hsl(var(--surface-raised))] shadow-[0_24px_60px_-20px_hsl(var(--surface-shadow)/0.55)] md:right-6',
            hideOnMobile && 'max-lg:hidden',
            fabPlacement === 'compact'
              ? 'bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-[10.5rem]'
              : 'bottom-[calc(12rem+env(safe-area-inset-bottom))] md:bottom-24',
          )}
        >
          <div className="flex items-center gap-3 border-b border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--status-info-surface)/0.5)] px-3.5 py-3">
            <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-[hsl(var(--brand-blue)/0.35)]">
              <OptimizedImage
                src={TUTOR_AVATAR}
                alt="AI 导师小迪"
                fill
                variant="thumbnail"
                loading="eager"
                className="object-cover"
              />
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

          <div ref={scrollRef} className="max-h-[min(52vh,420px)] flex-1 space-y-3 overflow-y-auto px-3.5 py-4">
            {view === 'history' && (
              <>
                {historyLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((item) => (
                      <div key={item} className="h-14 animate-pulse rounded-[var(--radius-sm)] bg-muted" />
                    ))}
                  </div>
                ) : !historyItems || historyItems.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    这个场景还没有历史对话。点「开启新对话」后，旧对话会出现在这里。
                  </p>
                ) : (
                  historyItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void openHistoryDetail(item)}
                      className="block w-full rounded-[var(--radius-sm)] border border-[hsl(var(--brand-blue)/0.15)] bg-[hsl(var(--surface-raised))] px-3 py-2.5 text-left transition-colors hover:bg-[hsl(var(--status-info-surface)/0.4)]"
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
                  ))
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
                  historyDetail?.messages.map((message, i) =>
                    message.role === 'assistant' ? (
                      <TutorBubble key={i}>
                        <TutorMessageContent content={message.content} />
                      </TutorBubble>
                    ) : (
                      <UserBubble key={i} message={message} />
                    ),
                  )
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
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  小迪正在准备这个场景…
                </span>
              </TutorBubble>
            )}
            {view === 'chat' && user && messages.length === 0 && !greeting && sessionQuery.isError && (
              <TutorBubble error>小迪场景加载失败，可以直接提问，我会在发送时重新连接。</TutorBubble>
            )}
            {view === 'chat' && messages.length === 0 && greeting && (
              <>
                <TutorBubble>{greeting.message}</TutorBubble>
                {user && context.contextType === 'challenge' && stageIndex != null && (
                  <div className="pl-9">
                    <button
                      type="button"
                      onClick={() => void sendMessage(buildStartStagePrompt(stageTitle || '当前阶段'))}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--brand-blue))] px-3.5 py-1.5 text-xs font-semibold text-[hsl(var(--brand-blue-foreground))] shadow-sm transition-transform hover:scale-[1.03] disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      带我开始这一步
                    </button>
                  </div>
                )}
                {user && (quickPrompts.length > 0 || greeting.quickPrompts.length > 0) && (
                  <div className="flex flex-wrap gap-2 pl-9">
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
              messages.map((message, i) =>
                message.role === 'assistant' ? (
                  <TutorBubble key={i} error={message.error}>
                    {message.content ? (
                      message.error ? (
                        message.content
                      ) : (
                        <TutorMessageContent content={message.content} />
                      )
                    ) : null}
                    {message.streaming && !message.content ? (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        小迪正在思考…
                      </span>
                    ) : null}
                  </TutorBubble>
                ) : (
                  <UserBubble key={i} message={message} />
                ),
              )}

            {view === 'chat' && busy && messages[messages.length - 1]?.role !== 'assistant' && (
              <TutorBubble>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  小迪正在思考…
                </span>
              </TutorBubble>
            )}

            {view === 'chat' && quota && !quota.canChat && (
              <div className="rounded-[var(--radius-sm)] border border-[hsl(var(--brand-blue)/0.25)] bg-[hsl(var(--status-info-surface)/0.35)] p-3 text-xs leading-5 text-foreground/85">
                今日免费次数或本月代币已用完。开通会员每月可获 {MEMBER_AI_MONTHLY_CREDITS} 代币，绝大多数时间够用～
              </div>
            )}
          </div>

          {view !== 'chat' ? (
            <div className="flex items-center justify-between gap-2 border-t border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--surface-raised)/0.7)] px-3.5 py-3">
              <p className="text-xs text-muted-foreground">
                {view === 'historyDetail' ? '历史对话仅可回看' : '点击一条历史对话即可回看'}
              </p>
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
          ) : user ? (
            <div className="space-y-2 border-t border-[hsl(var(--brand-blue)/0.18)] bg-[hsl(var(--surface-raised)/0.7)] px-3.5 py-3">
              {pendingImages.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {pendingImages.map((image) => (
                    <span key={image} className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[var(--radius-xs)] bg-muted">
                      <OptimizedImage src={image} alt="待发图片" fill variant="thumbnail" className="object-cover" />
                      <button
                        type="button"
                        onClick={() => removePendingImage(image)}
                        aria-label="移除图片"
                        className="absolute right-0 top-0 inline-flex h-4 w-4 items-center justify-center rounded-bl-[var(--radius-xs)] bg-black/55 text-white"
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
                        className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[var(--radius-xs)] bg-muted ring-1 ring-[hsl(var(--brand-blue)/0.2)] transition-transform hover:scale-105 disabled:opacity-50"
                      >
                        <OptimizedImage src={image} alt="场景照片" fill variant="thumbnail" className="object-cover" />
                      </button>
                    ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  hidden
                  onChange={(e) => void handleFilePick(e)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy || uploadingImage || pendingImages.length >= MAX_CHAT_IMAGES || (quota != null && !quota.canChat)}
                  aria-label="发图片给小迪"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[hsl(var(--brand-blue)/0.25)] text-[hsl(var(--brand-blue))] transition-colors hover:bg-[hsl(var(--status-info-surface)/0.5)] disabled:opacity-50"
                >
                  {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                </button>
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="问问小迪…（Enter 发送）"
                  className="min-h-[40px] flex-1 resize-none text-sm"
                  disabled={busy || (quota != null && !quota.canChat)}
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={submitComposer}
                  disabled={busy || uploadingImage || (!input.trim() && pendingImages.length === 0) || (quota != null && !quota.canChat)}
                  aria-label="发送"
                >
                  <Send className="h-4 w-4" />
                </Button>
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

      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? '收起 AI 导师' : '打开 AI 导师'}
        className={cn(
          'fixed right-4 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--surface-raised))] shadow-[0_16px_36px_-12px_hsl(var(--brand-blue)/0.6)] ring-2 ring-[hsl(var(--brand-blue)/0.4)] transition-transform hover:scale-105 active:scale-95 md:right-6',
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
            <span className="relative h-full w-full overflow-hidden rounded-full">
              <OptimizedImage
                src={TUTOR_AVATAR}
                alt="AI 导师小迪"
                fill
                variant="thumbnail"
                loading="eager"
                className="object-cover"
              />
            </span>
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--brand-blue))] ring-2 ring-[hsl(var(--surface-raised))]">
              <Sparkles className="h-2.5 w-2.5 text-[hsl(var(--brand-blue-foreground))]" />
            </span>
          </>
        )}
      </button>
    </>,
    document.body,
  )
}

function UserBubble({ message }: { message: TutorChatMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] space-y-1.5">
        {message.content ? (
          <div className="whitespace-pre-wrap rounded-[var(--radius-sm)] rounded-tr-sm bg-[hsl(var(--brand-blue))] px-3 py-2 text-[13px] leading-6 text-[hsl(var(--brand-blue-foreground))]">
            {message.content}
          </div>
        ) : null}
        {message.images && message.images.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {message.images.map((image, idx) => (
              <span key={idx} className="relative h-12 w-12 overflow-hidden rounded-[var(--radius-xs)] bg-muted">
                <OptimizedImage src={image} alt="产出图" fill variant="thumbnail" className="object-cover" />
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TutorBubble({ children, error }: { children: ReactNode; error?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="relative mt-0.5 h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-[hsl(var(--brand-blue)/0.3)]">
        <OptimizedImage src={TUTOR_AVATAR} alt="小迪" fill variant="thumbnail" className="object-cover" />
      </span>
      <div
        className={cn(
          'max-w-[80%] whitespace-pre-wrap rounded-[var(--radius-sm)] rounded-tl-sm px-3 py-2 text-[13px] leading-6',
          error
            ? 'bg-[hsl(var(--status-danger-surface)/0.7)] text-[hsl(var(--status-danger))]'
            : 'bg-[hsl(var(--surface-raised))] text-foreground/88',
        )}
      >
        {children}
      </div>
    </div>
  )
}
