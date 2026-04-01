"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/context/auth-context"
import { useLoginPrompt } from "@/context/login-prompt-context"
import { useToast } from "@/hooks/use-toast"
import type { Comment } from "@/lib/mappers/types"
import { cn } from "@/lib/utils"

interface ObservationCommentsProps {
  observationId: number
}

export function ObservationComments({ observationId }: ObservationCommentsProps) {
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const { toast } = useToast()
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [content, setContent] = useState("")
  const [replyTo, setReplyTo] = useState<{ id: number; name: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
        <p className="text-sm text-muted-foreground">加载评论中...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无评论，来说点什么吧。</p>
      ) : (
        <div className="space-y-3">
          {rootComments.map((comment) => (
            <div key={String(comment.id)}>
              <CommentItem
                comment={comment}
                onReply={(id, name) => {
                  setReplyTo({ id, name })
                  setContent("")
                }}
              />
              {(repliesMap.get(Number(comment.id)) || []).map((reply) => (
                <div key={String(reply.id)} className="ml-8 mt-2">
                  <CommentItem
                    comment={reply}
                    onReply={(id, name) => {
                      setReplyTo({ id, name })
                      setContent("")
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 pt-2 border-t">
        {replyTo && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>回复 {replyTo.name}</span>
            <button type="button" onClick={() => setReplyTo(null)} className="text-primary hover:underline">
              取消
            </button>
          </div>
        )}
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={replyTo ? `回复 ${replyTo.name}...` : "写一条评论..."}
          rows={2}
          className="resize-none"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || !content.trim()}>
            {isSubmitting ? "发送中..." : "发送"}
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
    <div className="rounded-xl border bg-muted/20 p-3">
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
