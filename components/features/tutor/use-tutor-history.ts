'use client'

import { useCallback, useEffect, useState, type MouseEvent, type MutableRefObject } from 'react'

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
  /** 最新场景 key；请求响应回来时用于丢弃过期场景的数据 */
  contextKeyRef: MutableRefObject<string>
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
  contextKeyRef,
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

  // 场景切换回到聊天视图，历史数据按新场景重新加载
  useEffect(() => {
    setView('chat')
    setHistoryItems(null)
    setHistoryDetail(null)
  }, [contextKey])

  const startNewTopic = useCallback(async () => {
    try {
      await fetch(`/api/tutor/chat?${buildParams()}`, { method: 'DELETE' })
    } catch {
      // ignore
    }
    setView('chat')
    setHistoryItems(null)
    setHistoryDetail(null)
    onResetChat()
    void loadSession()
  }, [buildParams, loadSession, onResetChat])

  const openHistory = useCallback(async () => {
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
      const params = new URLSearchParams({ contextType, contextId })
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
  }, [contextId, contextKeyRef, contextType, promptLogin, toast, user])

  const openHistoryDetail = useCallback(
    async (item: TutorHistoryItem) => {
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
    openHistory,
    openHistoryDetail,
    deleteHistoryConversation,
    exitHistory,
    closeHistory,
  }
}
