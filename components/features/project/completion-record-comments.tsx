"use client"

import { useCallback, useRef, useState } from "react"
import { Flag, Loader2 } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { ReportDialog } from "@/components/ui/report-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/context/auth-context"
import { useLoginPrompt } from "@/lib/context/login-prompt-context"
import { useToast } from "@/hooks/use-toast"
import { getRepliesUnderRoot } from "@/lib/comments/reply-utils"
import type { Comment } from "@/lib/mappers/types"
import { cn } from "@/lib/utils"
import {
  getApiErrorMessageFromPayload,
  getApiErrorPayload,
  getInteractionAccessRedirect,
  isAgeConfirmationRequired,
} from "@/lib/utils/http"

interface CompletionRecordCommentsProps {
  completionId: number
  enabled?: boolean
  className?: string
}

export function CompletionRecordComments({
  completionId,
  enabled = true,
  className,
}: CompletionRecordCommentsProps) {
  const { user } = useAuth()
  const { promptLogin, runAfterAgeConfirmation } = useLoginPrompt()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [content, setContent] = useState("")
  const [replyTo, setReplyTo] = useState<{ id: number; name: string } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const focusEditor = useCallback(() => {
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
    })
  }, [])

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["completion_comments", completionId, "thread"],
    queryFn: async () => {
      const response = await fetch(`/api/completions/${completionId}/comments?limit=200`)
      if (!response.ok) throw new Error(await response.text())
      const payload = await response.json()
      return (payload?.comments as Comment[]) || []
    },
    enabled,
    staleTime: 30_000,
  })

  const commentMutation = useMutation({
    mutationFn: async (payload: { content: string; parent_id: number | null }) => {
      const submitCommentRequest = () => fetch(`/api/completions/${completionId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      let response = await submitCommentRequest()
      let errorPayload = await getApiErrorPayload(response)
      if (!response.ok && isAgeConfirmationRequired(errorPayload)) {
        response = await runAfterAgeConfirmation(submitCommentRequest, {
          redirectTo: getInteractionAccessRedirect(errorPayload) ?? undefined,
        })
        errorPayload = await getApiErrorPayload(response)
      }
      if (!response.ok) {
        throw new Error(getApiErrorMessageFromPayload(errorPayload, "评论失败"))
      }
      return (await response.json()).comment as Comment
    },
    onSuccess: () => {
      setContent("")
      setReplyTo(null)
      queryClient.invalidateQueries({ queryKey: ["completion_comments", completionId] })
    },
    onError: (error) => {
      toast({
        title: "评论失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    },
  })

  const handleSubmit = () => {
    const trimmed = content.trim()
    if (!trimmed) return
    if (!user) {
      promptLogin(() => commentMutation.mutate({ content: trimmed, parent_id: replyTo?.id ?? null }), {
        title: "登录以评论",
        description: "登录后即可回复探索记录",
      })
      return
    }
    commentMutation.mutate({ content: trimmed, parent_id: replyTo?.id ?? null })
  }

  const rootComments = comments.filter((c) => !c.parent_id)

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="min-h-0 max-h-[50vh] flex-1 space-y-3 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 rounded-sm" />
            <Skeleton className="h-14 rounded-sm" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">还没有留言，来说说这个作品吧。</p>
        ) : (
          rootComments.map((comment) => (
            <div key={String(comment.id)}>
              <CompletionCommentItem
                comment={comment}
                viewerId={user?.id}
                onReply={(id, name) => {
                  setReplyTo({ id, name })
                  setContent("")
                  focusEditor()
                }}
              />
              {getRepliesUnderRoot(comments, comment.id).map((reply) => (
                <div
                  key={String(reply.id)}
                  className="ml-6 mt-2 border-l-2 border-[hsl(var(--surface-border)/0.8)] pl-3"
                >
                  <CompletionCommentItem
                    comment={reply}
                    viewerId={user?.id}
                    onReply={(id, name) => {
                      setReplyTo({ id, name })
                      setContent("")
                      focusEditor()
                    }}
                  />
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="mt-4 shrink-0 space-y-2 border-t border-[hsl(var(--surface-border)/0.7)] pt-3">
        {replyTo ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              回复 <span className="font-semibold text-foreground">{replyTo.name}</span>
            </span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="text-[hsl(var(--brand-green))] hover:underline"
            >
              取消
            </button>
          </div>
        ) : null}
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={replyTo ? `回复 ${replyTo.name}…` : "聊聊这个作品，或提出你的问题…"}
          rows={2}
          className="resize-none"
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={commentMutation.isPending || !content.trim()}
          >
            {commentMutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                发送中
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

function CompletionCommentItem({
  comment,
  viewerId,
  onReply,
}: {
  comment: Comment
  viewerId?: string
  onReply: (id: number, name: string) => void
}) {
  const displayName = comment.author || "探索者"
  const canReport = Boolean(viewerId && comment.userId && viewerId !== comment.userId)
  const commentKindLabel = comment.parent_id ? "回复" : "评论"

  return (
    <div className="rounded-sm bg-muted/40 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-xs text-foreground">
          <span className="font-semibold">{displayName}</span>
          {comment.reply_to_username ? (
            <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
              回复 @{comment.reply_to_username}
            </span>
          ) : null}
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => onReply(Number(comment.id), displayName)}
            className="inline-flex h-11 min-w-11 items-center justify-center rounded-full px-2 text-[11px] font-medium text-muted-foreground hover:text-[hsl(var(--brand-green))]"
          >
            回复
          </button>
          {canReport ? (
            <ReportDialog contentType="completion_comment" contentId={comment.id}>
              <button
                type="button"
                aria-label={`举报 ${displayName} 的${commentKindLabel}`}
                title="举报"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted hover:text-destructive focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-destructive/40"
              >
                <Flag className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </ReportDialog>
          ) : null}
        </div>
      </div>
      <p className="mt-1 text-sm leading-5 text-foreground whitespace-pre-wrap wrap-break-word">{comment.content}</p>
    </div>
  )
}

/** 列表卡片下的评论预览（最多 2 条，含回复样式） */
export function CompletionRecordCommentsPreview({
  completionId,
  total,
  onExpand,
  previewComments,
}: {
  completionId: number
  total: number
  onExpand: () => void
  /** 父级批量接口已拉取时传入，避免每条记录单独请求 */
  previewComments?: Comment[]
}) {
  const { data: fetchedComments = [] } = useQuery({
    queryKey: ["completion_comments", completionId, "preview"],
    queryFn: async () => {
      const response = await fetch(`/api/completions/${completionId}/comments?limit=50`)
      if (!response.ok) return []
      const payload = await response.json()
      return (payload?.comments as Comment[]) || []
    },
    enabled: total > 0 && previewComments === undefined,
    staleTime: 30_000,
  })

  const preview = (previewComments ?? fetchedComments).slice(-2)
  if (preview.length === 0) return null

  return (
    <div className="mt-3 space-y-2 rounded-sm bg-muted/35 px-3 py-2.5">
      {preview.map((comment) => (
        <p key={String(comment.id)} className="text-xs leading-5 text-muted-foreground">
          <span className="font-semibold text-foreground">{comment.author}</span>
          {comment.reply_to_username ? (
            <span className="text-muted-foreground"> 回复 @{comment.reply_to_username}</span>
          ) : null}
          <span className="mx-1">:</span>
          {comment.content}
        </p>
      ))}
      {total > preview.length ? (
        <button type="button" onClick={onExpand} className="text-xs font-semibold text-[hsl(var(--brand-green))]">
          查看全部 {total} 条评论 &gt;
        </button>
      ) : null}
    </div>
  )
}
