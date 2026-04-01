"use client"

import { useState, useEffect, useCallback } from "react"
import { Heart, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth-context"
import { useLoginPrompt } from "@/context/login-prompt-context"
import { cn } from "@/lib/utils"

interface ObservationInteractionsProps {
  observationId: number
  initialLikesCount: number
  initialCommentsCount: number
  onToggleComments?: () => void
  commentsOpen?: boolean
}

export function ObservationInteractions({
  observationId,
  initialLikesCount,
  initialCommentsCount,
  onToggleComments,
  commentsOpen,
}: ObservationInteractionsProps) {
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const [liked, setLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(initialLikesCount)
  const [isLiking, setIsLiking] = useState(false)

  useEffect(() => {
    if (!user) return
    fetch(`/api/observations/${observationId}/like`, { method: "HEAD" })
      .catch(() => {})

    const controller = new AbortController()
    const checkLike = async () => {
      try {
        const res = await fetch(`/api/observations/${observationId}`, { signal: controller.signal })
        if (!res.ok) return
      } catch {}
    }
    checkLike()
    return () => controller.abort()
  }, [user, observationId])

  const handleLike = useCallback(async () => {
    if (!user) {
      promptLogin(undefined, { title: "登录以点赞", description: "登录后即可为观察记录点赞" })
      return
    }
    if (isLiking) return
    setIsLiking(true)

    const wasLiked = liked
    setLiked(!wasLiked)
    setLikesCount((c) => c + (wasLiked ? -1 : 1))

    try {
      const res = await fetch(`/api/observations/${observationId}/like`, {
        method: wasLiked ? "DELETE" : "POST",
      })
      if (!res.ok) throw new Error()
    } catch {
      setLiked(wasLiked)
      setLikesCount((c) => c + (wasLiked ? 1 : -1))
    } finally {
      setIsLiking(false)
    }
  }, [user, liked, isLiking, observationId, promptLogin])

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLike}
        className={cn(
          "gap-2 text-muted-foreground transition-colors",
          liked && "text-red-500 hover:text-red-600",
        )}
      >
        <Heart className={cn("h-4 w-4", liked && "fill-current")} />
        {likesCount > 0 ? likesCount : "点赞"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleComments}
        className={cn(
          "gap-2 text-muted-foreground transition-colors",
          commentsOpen && "text-primary",
        )}
      >
        <MessageCircle className="h-4 w-4" />
        {initialCommentsCount > 0 ? initialCommentsCount : "评论"}
      </Button>
    </div>
  )
}
