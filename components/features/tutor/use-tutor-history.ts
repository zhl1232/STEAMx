'use client'

import { useCallback, useEffect, useRef, useState, type MouseEvent, type MutableRefObject } from 'react'

import type { TutorChatMessage } from '@/components/features/tutor/use-tutor-chat-stream'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/context/auth-context'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'

export type TutorPanelView = 'chat' | 'history' | 'historyDetail'

export type TutorHistoryItem = {
  id: string
  title: string
  preview: string
  createdAt: string
  archivedAt: string | null
}

export type TutorHistoryDetail = {
  id: string
  title: string
  archivedAt: string | null
  messages: TutorChatMessage[]
}

export type UseTutorHistoryOptions = {
  contextKey: string
  epoch?: number
  /** 最新场景 key；请求响应回来时用于丢弃过期场景的数据 */
  contextKeyRef: MutableRefObject<string>
  busyRef: MutableRefObject<boolean>
  contextType: string
  contextId: string
  /** 当前场景的 /api/tutor/chat query 参数（归档当前会话用） */
  buildParams: () => URLSearchParams
  /** 归档后重新拉取会话（新开场白等） */
  loadSession: () => Promise<void>
  /** 开启新对话时清空本地消息与开场白（须为稳定引用） */
  onResetChat: () => void
}

/**
 * 小迪历史会话控制器：视图切换（chat / history / historyDetail）、
 * 历史列表与详情加载、删除、开启新对话。
 */
export function useTutorHistory({
  contextKey,
  epoch,
  contextKeyRef,
  busyRef,
  contextType,
  contextId,
  buildParams,
  loadSession,
  onResetChat,
}: UseTutorHistoryOptions) {
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const { toast } = useToast()

  const [view, setView] = useState<TutorPanelView>('chat')
  const [historyItems, setHistoryItems] = useState<TutorHistoryItem[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyDetail, setHistoryDetail] = useState<TutorHistoryDetail | null>(null)
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false)
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null)
  const [startingNewTopic, setStartingNewTopic] = useState(false)
  const newTopicPendingRef = useRef(false)
  const scopeGenerationRef = useRef(0)

  // 场景切换回到聊天视图，历史数据按新场景重新加载
  useEffect(() => {
    scopeGenerationRef.current += 1
    setView('chat')
    setHistoryItems(null)
    setHistoryDetail(null)
    setHistoryLoading(false)
    setHistoryDetailLoading(false)
    setDeletingHistoryId(null)
    newTopicPendingRef.current = false
    setStartingNewTopic(false)
    return () => { scopeGenerationRef.current += 1 }
  }, [contextKey])

  const startNewTopic = useCallback(async () => {
    if (!user || busyRef.current || newTopicPendingRef.current) return
    const requestKey = contextKeyRef.current
    const generation = scopeGenerationRef.current
    const isCurrent = () => contextKeyRef.current === requestKey && scopeGenerationRef.current === generation
    newTopicPendingRef.current = true
    busyRef.current = true
    setStartingNewTopic(true)
    try {
      if (!Number.isSafeInteger(epoch)) throw new Error('Session not loaded')
      const params = buildParams()
      params.set('epoch', String(epoch))
      const response = await fetch(`/api/tutor/chat?${params}`, { method: 'DELETE' })
      if (!response.ok) throw new Error()
      if (!isCurrent()) return
      setView('chat')
      setHistoryItems(null)
      setHistoryDetail(null)
      onResetChat()
      busyRef.current = true
      await loadSession()
    } catch {
      if (isCurrent()) toast({ title: '新对话未能开启，当前对话已保留', variant: 'destructive' })
    } finally {
      if (isCurrent()) {
        newTopicPendingRef.current = false
        busyRef.current = false
        setStartingNewTopic(false)
      }
    }
  }, [buildParams, busyRef, contextKeyRef, epoch, loadSession, onResetChat, toast, user])

  const openHistory = useCallback(async () => {
    if (!user) {
      promptLogin(() => undefined, {
        title: '登录后找小迪',
        description: '登录后即可查看和小迪的历史对话。',
      })
      return
    }
    const requestKey = contextKeyRef.current
    const generation = scopeGenerationRef.current
    const isCurrent = () => contextKeyRef.current === requestKey && scopeGenerationRef.current === generation
    setView('history')
    setHistoryDetail(null)
    setHistoryLoading(true)
    try {
      const params = new URLSearchParams({ contextType, contextId })
      const res = await fetch(`/api/tutor/conversations?${params}`)
      if (!res.ok) throw new Error()
      const payload = await res.json()
      if (!isCurrent()) return
      setHistoryItems(Array.isArray(payload.conversations) ? payload.conversations : [])
    } catch {
      if (!isCurrent()) return
      setHistoryItems([])
      toast({ title: '历史对话加载失败，请稍后再试', variant: 'destructive' })
    } finally {
      if (isCurrent()) setHistoryLoading(false)
    }
  }, [contextId, contextKeyRef, contextType, promptLogin, toast, user])

  const openHistoryDetail = useCallback(
    async (item: TutorHistoryItem) => {
      const requestKey = contextKeyRef.current
      const generation = scopeGenerationRef.current
      const isCurrent = () => contextKeyRef.current === requestKey && scopeGenerationRef.current === generation
      setView('historyDetail')
      setHistoryDetail({ id: item.id, title: item.title, archivedAt: item.archivedAt, messages: [] })
      setHistoryDetailLoading(true)
      try {
        const res = await fetch(`/api/tutor/conversations/${item.id}`)
        if (!res.ok) throw new Error()
        const payload = await res.json()
        if (!isCurrent()) return
        setHistoryDetail({
          id: item.id,
          title: payload.conversation?.title ?? item.title,
          archivedAt: payload.conversation?.archivedAt ?? item.archivedAt,
          messages: Array.isArray(payload.messages) ? payload.messages : [],
        })
      } catch {
        if (!isCurrent()) return
        setView('history')
        setHistoryDetail(null)
        toast({ title: '这条历史对话打开失败，请稍后再试', variant: 'destructive' })
      } finally {
        if (isCurrent()) setHistoryDetailLoading(false)
      }
    },
    [contextKeyRef, toast],
  )

  const deleteHistoryConversation = useCallback(
    async (conversation: Pick<TutorHistoryItem, 'id' | 'title'>, event?: MouseEvent<HTMLButtonElement>) => {
      event?.preventDefault()
      event?.stopPropagation()
      if (deletingHistoryId) return

      const title = conversation.title || '这条历史对话'
      if (!window.confirm(`确定删除「${title}」吗？删除后不能恢复。`)) return

      const requestKey = contextKeyRef.current
      const generation = scopeGenerationRef.current
      const isCurrent = () => contextKeyRef.current === requestKey && scopeGenerationRef.current === generation
      setDeletingHistoryId(conversation.id)
      try {
        const res = await fetch(`/api/tutor/conversations/${conversation.id}`, { method: 'DELETE' })
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: unknown } | null
          throw new Error(typeof payload?.error === 'string' ? payload.error : '请稍后再试')
        }
        if (!isCurrent()) return
        setHistoryItems((current) => current?.filter((item) => item.id !== conversation.id) ?? current)
        setHistoryDetail((current) => (current?.id === conversation.id ? null : current))
        if (view === 'historyDetail' && historyDetail?.id === conversation.id) {
          setView('history')
        }
        toast({ title: '历史对话已删除' })
      } catch (error) {
        if (!isCurrent()) return
        toast({
          title: '历史对话删除失败',
          description: error instanceof Error ? error.message : '请稍后再试',
          variant: 'destructive',
        })
      } finally {
        if (isCurrent()) {
          setDeletingHistoryId((current) => (current === conversation.id ? null : current))
        }
      }
    },
    [contextKeyRef, deletingHistoryId, historyDetail?.id, toast, view],
  )

  const exitHistory = useCallback(() => {
    if (view === 'historyDetail') {
      setView('history')
      setHistoryDetail(null)
    } else {
      setView('chat')
    }
  }, [view])

  /** 「返回当前对话」：无论在哪个历史视图都直接回聊天 */
  const closeHistory = useCallback(() => {
    setView('chat')
    setHistoryDetail(null)
  }, [])

  return {
    view,
    historyItems,
    historyLoading,
    historyDetail,
    historyDetailLoading,
    deletingHistoryId,
    startNewTopic,
    startingNewTopic,
    openHistory,
    openHistoryDetail,
    deleteHistoryConversation,
    exitHistory,
    closeHistory,
  }
}
