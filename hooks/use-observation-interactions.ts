"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/context/auth-context"
import { useLoginPrompt } from "@/lib/context/login-prompt-context"

interface UseObservationInteractionsOptions {
  observationId: number
  initialLikesCount: number
  initialCommentsCount: number
}

export function useObservationInteractions({
  observationId,
  initialLikesCount,
  initialCommentsCount,
}: UseObservationInteractionsOptions) {
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const { toast } = useToast()

  const [liked, setLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(initialLikesCount)
  const [commentsCount, setCommentsCount] = useState(initialCommentsCount)
  const [isLiking, setIsLiking] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)

  useEffect(() => {
    setLikesCount(initialLikesCount)
  }, [initialLikesCount])

  useEffect(() => {
    setCommentsCount(initialCommentsCount)
  }, [initialCommentsCount])

  useEffect(() => {
    if (!user) {
      setLiked(false)
      return
    }

    const controller = new AbortController()

    const loadLikeState = async () => {
      try {
        const response = await fetch(`/api/observations/${observationId}/like`, {
          signal: controller.signal,
        })
        if (!response.ok) return
        const payload = (await response.json()) as { liked?: boolean }
        setLiked(Boolean(payload.liked))
      } catch {
        // noop
      }
    }

    void loadLikeState()
    return () => controller.abort()
  }, [observationId, user])

  const toggleLike = useCallback(async () => {
    if (!user) {
      promptLogin(undefined, { title: "登录以点赞", description: "登录后即可为观察记录点赞" })
      return
    }
    if (isLiking) return

    const wasLiked = liked
    setLiked(!wasLiked)
    setLikesCount((value) => value + (wasLiked ? -1 : 1))
    setIsLiking(true)

    try {
      const response = await fetch(`/api/observations/${observationId}/like`, {
        method: wasLiked ? "DELETE" : "POST",
      })
      if (!response.ok) throw new Error()
    } catch {
      setLiked(wasLiked)
      setLikesCount((value) => value + (wasLiked ? 1 : -1))
      toast({
        title: "点赞失败",
        description: "网络波动导致操作未生效，请稍后重试。",
        variant: "destructive",
      })
    } finally {
      setIsLiking(false)
    }
  }, [isLiking, liked, observationId, promptLogin, toast, user])

  const toggleComments = useCallback(() => {
    setCommentsOpen((value) => !value)
  }, [])

  const openComments = useCallback(() => {
    setCommentsOpen(true)
  }, [])

  const closeComments = useCallback(() => {
    setCommentsOpen(false)
  }, [])

  const increaseCommentsCount = useCallback(() => {
    setCommentsCount((value) => value + 1)
  }, [])

  return useMemo(
    () => ({
      liked,
      likesCount,
      commentsCount,
      isLiking,
      commentsOpen,
      toggleLike,
      toggleComments,
      openComments,
      closeComments,
      increaseCommentsCount,
    }),
    [
      closeComments,
      commentsCount,
      commentsOpen,
      increaseCommentsCount,
      isLiking,
      liked,
      likesCount,
      openComments,
      toggleComments,
      toggleLike,
    ],
  )
}
