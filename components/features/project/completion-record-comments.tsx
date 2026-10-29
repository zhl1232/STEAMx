"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Flag, Loader2 } from "lucide-react"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

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
} from "@/lib/utils/http"

import { ExchangeRewardHint, GrowthQualityBadge, useExchangeFeedback } from '@/components/features/growth/exchange-feedback'
import { emptyQuestionDraft, loadQuestionDraft, saveQuestionDraft } from '@/lib/project/question-draft'
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
  const { promptLogin } = useLoginPrompt()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [content, setContent] = useState("")
  const [replyTo, setReplyTo] = useState<{ id: number; name: string } | null>(null)
  const accountRef = useRef(user?.id || null)
  const [submitted, setSubmitted] = useState<{id:number;at:number}|null>(null)
  useEffect(() => {
    accountRef.current = user?.id || null
    const draft = loadQuestionDraft(user?.id || null, `work-${completionId}`)
    setContent(draft.text); setReplyTo(draft.replyId ? {id:draft.replyId,name:draft.replyName || '探索者'} : null); setSubmitted(null)
  }, [user?.id, completionId])
  const persist = (text:string, reply: typeof replyTo) => saveQuestionDraft(user?.id || null, `work-${completionId}`, {...emptyQuestionDraft(),text,replyId:reply?.id || null,replyName:reply?.name || null})
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const focusEditor = useCallback(() => {
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
    })
  }, [])

  const {
    data, isLoading, isError, isFetchingNextPage, isFetchNextPageError,
    hasNextPage, fetchNextPage, refetch,
  } = useInfiniteQuery({
    queryKey: ["completion_comments", completionId, "thread", "cursor", user?.id],
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam, signal }) => {
      const params = new URLSearchParams({ pagination: "cursor", limit: "10" })
      if (pageParam !== null) params.set("after", String(pageParam))
      const response = await fetch(`/api/completions/${completionId}/comments?${params}`, { signal })
      if (!response.ok) throw new Error("留言加载失败，请重试")
      return response.json() as Promise<{ comments: Comment[]; nextCursor: number | null }>
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
    refetchInterval: () => submitted && Date.now()-submitted.at<60_000 ? 5000 : false,
    staleTime: 30_000,
  })
  const comments = [...new Map((data?.pages.flatMap(page => page.comments) ?? [])
    .map(comment => [String(comment.id), comment])).values()]


  const feedback = useExchangeFeedback('comment', comments.map(c=>Number(c.id)).concat(submitted?[submitted.id]:[]), submitted)

  const commentMutation = useMutation({
    mutationFn: async (payload: { content: string; parent_id: number | null; account: string }) => {
      const submitCommentRequest = () => fetch(`/api/completions/${completionId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({content:payload.content,parent_id:payload.parent_id}),
      })
      const response = await submitCommentRequest()
      const errorPayload = await getApiErrorPayload(response)
      if (!response.ok) {
        throw new Error(getApiErrorMessageFromPayload(errorPayload, "评论失败"))
      }
      return (await response.json()).comment as Comment
    },
    onSuccess: (comment, payload) => {
      if (accountRef.current !== payload.account) return
      if (comment?.id) setSubmitted({id:Number(comment.id),at:Date.now()})
      persist('',null)
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
      promptLogin(nextUser => {if(accountRef.current && accountRef.current!==nextUser.id)return;accountRef.current=nextUser.id;commentMutation.mutate({ content: trimmed, parent_id: replyTo?.id ?? null, account:nextUser.id })}, {
        title: "登录以评论",
        description: "登录后即可回复探索记录",
      })
      return
    }
    commentMutation.mutate({ content: trimmed, parent_id: replyTo?.id ?? null, account:user.id })
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
        ) : isError && comments.length === 0 ? (
          <div className="py-4 text-sm text-muted-foreground" role="alert">
            <p>留言加载失败，请重试。</p>
            <Button variant="ghost" className="mt-1 min-h-11" onClick={() => refetch()}>重新加载</Button>
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
                feedback={feedback}
                viewerId={user?.id}
                onReply={(id, name) => {
                  setReplyTo({ id, name }); persist(content,{id,name})
                  focusEditor()
                }}
              />
            )
          })
        )}
      </div>

      {comments.length > 0 && (hasNextPage || (data?.pages.length ?? 0) > 1 || isError) ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground" role="status">已加载 {comments.length} 条留言与回复</p>
          {hasNextPage ? (
            <Button
              variant="ghost"
              className="min-h-11"
              disabled={isFetchingNextPage}
              onClick={() => fetchNextPage()}
            >
              {isFetchingNextPage ? "加载中…" : isFetchNextPageError ? "加载失败，重试" : "加载更多"}
            </Button>
          ) : null}
          {isError && !isFetchNextPageError ? (
            <Button variant="ghost" className="min-h-11" onClick={() => refetch()}>刷新失败，重试</Button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 shrink-0 space-y-2.5 border-t border-border/70 pt-4">
        {replyTo ? (
          <div className="flex items-center justify-between rounded-sm bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
            <span>
              回复 <span className="font-semibold text-foreground">@{replyTo.name}</span>
            </span>
            <button
              type="button"
              onClick={() => {setReplyTo(null);persist(content,null)}}
              className="min-h-11 px-2 text-xs text-[hsl(var(--brand-green))] hover:underline"
            >
              取消回复
            </button>
          </div>
        ) : null}
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {setContent(e.target.value);persist(e.target.value,replyTo)}}
          maxLength={2000}
          placeholder={replyTo ? `回复 @${replyTo.name}…` : "聊聊这个作品，或提出你的问题与建议…"}
          rows={3}
          className="resize-none"
        />
        {submitted && !comments.some(comment => Number(comment.id) === submitted.id) ? (
          <p className="text-sm text-muted-foreground" role="status">留言已提交，审核通过后会公开显示。</p>
        ) : null}
        <ExchangeRewardHint />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            className="min-h-11 px-4"
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
  feedback,
  viewerId,
  onReply,
}: {
  comment: Comment
  replies: Comment[]
  feedback: Map<number, {qualified:boolean}>
  viewerId?: string
  onReply: (id: number, name: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const displayName = comment.author || "探索者"
  const canReport = Boolean(viewerId && comment.userId && viewerId !== comment.userId)

  return (
    <div className="pt-3 pb-0 first:pt-1 last:pb-0">
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
            <span className="text-xs font-semibold text-foreground">{displayName}</span><GrowthQualityBadge qualified={feedback.get(Number(comment.id))?.qualified}/>
          </div>

          <p className="mt-1 text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
            {comment.content}
          </p>

          <div className="mt-0 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="leading-none">{comment.date || "刚刚"}</span>
            <span className="leading-none text-muted-foreground/40" aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => onReply(Number(comment.id), displayName)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center leading-none font-medium text-muted-foreground hover:text-[hsl(var(--brand-green))] transition-colors"
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
                    className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 leading-none text-muted-foreground/60 hover:text-destructive transition-colors focus-visible:outline-hidden"
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
          {(expanded ? replies : replies.slice(0,2)).map((reply) => {
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
                    <span className="font-semibold">{replyDisplayName}</span><GrowthQualityBadge qualified={feedback.get(Number(reply.id))?.qualified}/>
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

                  <div className="mt-0 flex items-center gap-2 text-[11px] text-muted-foreground/80">
                    <span className="leading-none">{reply.date || "刚刚"}</span>
                    <span className="leading-none text-muted-foreground/40" aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => onReply(Number(reply.id), replyDisplayName)}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center leading-none font-medium hover:text-[hsl(var(--brand-green))] transition-colors"
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
                            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 leading-none text-muted-foreground/60 hover:text-destructive transition-colors focus-visible:outline-hidden"
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
          {replies.length>2 && <button type="button" className="min-h-11 px-2" onClick={()=>setExpanded(!expanded)}>{expanded?'收起回复':`展开其余 ${replies.length-2} 条回复`}</button>}
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
  const feedback = useExchangeFeedback('comment', preview.map(c=>Number(c.id)), null)
  if (preview.length === 0) return null

  return (
    <div className="mt-3 space-y-2 rounded-sm bg-muted/35 px-3 py-2.5">
      {preview.map((comment) => (
        <p key={String(comment.id)} className="text-xs leading-5 text-muted-foreground">
          <span className="font-semibold text-foreground">{comment.author}</span><GrowthQualityBadge qualified={feedback.get(Number(comment.id))?.qualified}/>
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
