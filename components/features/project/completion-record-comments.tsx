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

import { UserAvatar } from "@/components/ui/user-avatar"

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
      <div className="divide-y divide-border/50">
        {isLoading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-16 rounded-md" />
            <Skeleton className="h-16 rounded-md" />
          </div>
        ) : comments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 p-6 text-center">
            <p className="text-sm text-muted-foreground">还没有留言，来说说对这个作品的想法或提出你的问题吧。</p>
          </div>
        ) : (
          rootComments.map((comment) => {
            const replies = getRepliesUnderRoot(comments, comment.id)
            return (
              <CompletionCommentThread
                key={String(comment.id)}
                comment={comment}
                replies={replies}
                viewerId={user?.id}
                onReply={(id, name) => {
                  setReplyTo({ id, name })
                  focusEditor()
                }}
              />
            )
          })
        )}
      </div>

      <div className="mt-6 shrink-0 space-y-2.5 border-t border-border/70 pt-4">
        {replyTo ? (
          <div className="flex items-center justify-between rounded-sm bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
            <span>
              回复 <span className="font-semibold text-foreground">@{replyTo.name}</span>
            </span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="text-xs text-[hsl(var(--brand-green))] hover:underline"
            >
              取消回复
            </button>
          </div>
        ) : null}
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={replyTo ? `回复 @${replyTo.name}…` : "聊聊这个作品，或提出你的问题与建议…"}
          rows={3}
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
              "发表留言"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

function CompletionCommentThread({
  comment,
  replies,
  viewerId,
  onReply,
}: {
  comment: Comment
  replies: Comment[]
  viewerId?: string
  onReply: (id: number, name: string) => void
}) {
  const displayName = comment.author || "探索者"
  const canReport = Boolean(viewerId && comment.userId && viewerId !== comment.userId)

  return (
    <div className="py-4.5 first:pt-1 last:pb-2 sm:py-5">
      <div className="flex items-start gap-3">
        <UserAvatar
          userId={comment.userId}
          name={displayName}
          src={comment.avatar}
          avatarFrameId={comment.avatarFrameId}
          fallback={displayName[0] || "?"}
          className="h-8 w-8 text-xs shrink-0 mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">{displayName}</span>
          </div>

          <p className="mt-1 text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
            {comment.content}
          </p>

          <div className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="leading-none">{comment.date || "刚刚"}</span>
            <span className="leading-none text-muted-foreground/40" aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => onReply(Number(comment.id), displayName)}
              className="inline-flex items-center leading-none font-medium text-muted-foreground hover:text-[hsl(var(--brand-green))] transition-colors"
            >
              回复
            </button>
            {canReport ? (
              <>
                <span className="leading-none text-muted-foreground/40" aria-hidden="true">·</span>
                <ReportDialog contentType="completion_comment" contentId={comment.id}>
                  <button
                    type="button"
                    aria-label={`举报 ${displayName} 的评论`}
                    title="举报"
                    className="inline-flex items-center gap-1 leading-none text-muted-foreground/60 hover:text-destructive transition-colors focus-visible:outline-hidden"
                  >
                    <Flag className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span>举报</span>
                  </button>
                </ReportDialog>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {replies.length > 0 ? (
        <div className="mt-3.5 w-full space-y-3.5 rounded-md bg-[hsl(var(--surface-muted)/0.45)] p-3 text-xs sm:mt-4 sm:p-3.5">
          {replies.map((reply) => {
            const replyDisplayName = reply.author || "探索者"
            const canReportReply = Boolean(viewerId && reply.userId && viewerId !== reply.userId)

            return (
              <div key={String(reply.id)} className="flex items-start gap-2.5">
                <UserAvatar
                  userId={reply.userId}
                  name={replyDisplayName}
                  src={reply.avatar}
                  avatarFrameId={reply.avatarFrameId}
                  fallback={replyDisplayName[0] || "?"}
                  className="h-5 w-5 text-[10px] shrink-0 mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="leading-relaxed text-foreground">
                    <span className="font-semibold">{replyDisplayName}</span>
                    {reply.userId && comment.userId && reply.userId === comment.userId ? (
                      <span className="ml-1 inline-flex items-center rounded-xs bg-[hsl(var(--brand-green)/0.12)] px-1 py-0.2 text-[10px] font-semibold text-[hsl(var(--brand-green))]">
                        作者
                      </span>
                    ) : null}
                    {reply.reply_to_username ? (
                      <span className="ml-1.5 inline-flex items-center rounded-xs bg-[hsl(var(--brand-blue)/0.1)] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--brand-blue))]">
                        回复 @{reply.reply_to_username}
                      </span>
                    ) : null}
                    <span className="mx-1 text-muted-foreground/60">:</span>
                    <span className="text-foreground/90 whitespace-pre-wrap break-words">{reply.content}</span>
                  </p>

                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground/80">
                    <span className="leading-none">{reply.date || "刚刚"}</span>
                    <span className="leading-none text-muted-foreground/40" aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => onReply(Number(reply.id), replyDisplayName)}
                      className="inline-flex items-center leading-none font-medium hover:text-[hsl(var(--brand-green))] transition-colors"
                    >
                      回复
                    </button>
                    {canReportReply ? (
                      <>
                        <span className="leading-none text-muted-foreground/40" aria-hidden="true">·</span>
                        <ReportDialog contentType="completion_comment" contentId={reply.id}>
                          <button
                            type="button"
                            aria-label={`举报 ${replyDisplayName} 的回复`}
                            title="举报"
                            className="inline-flex items-center gap-1 leading-none text-muted-foreground/60 hover:text-destructive transition-colors focus-visible:outline-hidden"
                          >
                            <Flag className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span>举报</span>
                          </button>
                        </ReportDialog>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
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
