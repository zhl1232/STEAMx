"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Loader2, MessageCircleMore } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from '@/lib/context/auth-context'
import { useLoginPrompt } from '@/lib/context/login-prompt-context'
import { useToast } from "@/hooks/use-toast"
import type { Comment } from "@/lib/mappers/types"
import { cn } from "@/lib/utils"

interface ObservationCommentsProps {
  observationId: number
  onCommentCreated?: () => void
}

export function ObservationComments({ observationId, onCommentCreated }: ObservationCommentsProps) {
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const { toast } = useToast()
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [content, setContent] = useState("")
  const [replyTo, setReplyTo] = useState<{ id: number; name: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const focusEditor = useCallback(() => {
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    })
  }, [])

  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/observations/${observationId}/comments`)
      if (!res.ok) return
      const data = await res.json()
      setComments(data.comments || [])
    } catch {
    } finally {
      setIsLoading(false)
    }
  }, [observationId])

  useEffect(() => {
    loadComments()
  }, [loadComments])

  const handleSubmit = async () => {
    if (!user) {
      promptLogin(undefined, { title: "登录以评论", description: "登录后即可对观察记录发表评论" })
      return
    }

    const trimmed = content.trim()
    if (!trimmed) return
    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/observations/${observationId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmed,
          parent_id: replyTo?.id ?? null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "评论失败")
      }
      const data = await res.json()
      setComments((prev) => [...prev, data.comment as Comment])
      setContent("")
      setReplyTo(null)
      onCommentCreated?.()
      focusEditor()
    } catch (err) {
      toast({
        title: "评论失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const rootComments = comments.filter((c) => !c.parent_id)
  const repliesMap = new Map<number, Comment[]>()
  for (const c of comments) {
    if (c.parent_id) {
      const list = repliesMap.get(c.parent_id) || []
      list.push(c)
      repliesMap.set(c.parent_id, list)
    }
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-16 rounded-md" />
        </div>
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/80 bg-background/60 px-4 py-8 text-center">
          <MessageCircleMore className="h-5 w-5 text-muted-foreground/80" aria-hidden />
          <p className="text-sm text-muted-foreground">暂无评论，来说点什么吧。</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {rootComments.map((comment) => (
              <motion.div
                key={String(comment.id)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <CommentItem
                  comment={comment}
                  onReply={(id, name) => {
                    setReplyTo({ id, name })
                    setContent("")
                    focusEditor()
                  }}
                />
                {(repliesMap.get(Number(comment.id)) || []).map((reply) => (
                  <motion.div
                    key={String(reply.id)}
                    className="ml-8 mt-2"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CommentItem
                      comment={reply}
                      onReply={(id, name) => {
                        setReplyTo({ id, name })
                        setContent("")
                        focusEditor()
                      }}
                    />
                  </motion.div>
                ))}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="space-y-2 border-t border-border/70 pt-2">
        {replyTo && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>回复 {replyTo.name}</span>
            <button type="button" onClick={() => setReplyTo(null)} className="text-primary hover:underline">
              取消
            </button>
          </div>
        )}
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={replyTo ? `回复 ${replyTo.name}...` : "写一条评论..."}
          rows={2}
          className="resize-none rounded-md"
        />
        <div className="flex justify-end">
          <Button size="sm" className="rounded-full" onClick={handleSubmit} disabled={isSubmitting || !content.trim()}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                发送中...
              </>
            ) : (
              "发送"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

function CommentItem({
  comment,
  onReply,
}: {
  comment: Comment
  onReply: (id: number, name: string) => void
}) {
  const displayName = comment.author || "匿名用户"
  const created = comment.created_at ? new Date(comment.created_at).toLocaleString("zh-CN") : comment.date

  return (
    <div className="rounded-md border border-border/70 bg-background/80 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={cn("font-medium", comment.role === "admin" && "text-primary")}>{displayName}</span>
        <span>·</span>
        <span>{created}</span>
      </div>
      {comment.reply_to_username && (
        <p className="mt-1 text-xs text-muted-foreground">回复 @{comment.reply_to_username}</p>
      )}
      <p className="mt-1.5 text-sm leading-6 text-foreground/90 whitespace-pre-wrap break-words">{comment.content}</p>
      <button
        type="button"
        onClick={() => onReply(Number(comment.id), displayName)}
        className="mt-1.5 text-xs text-muted-foreground hover:text-primary"
      >
        回复
      </button>
    </div>
  )
}
