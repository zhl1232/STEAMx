"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronRight, Heart, MessageCircle } from "lucide-react"
import Link from "next/link"

import { OptimizedImage } from "@/components/ui/optimized-image"
import { UserAvatar } from "@/components/ui/user-avatar"
import {
  CompletionRecordComments,
  CompletionRecordCommentsPreview,
} from "@/components/features/project/completion-record-comments"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useAuth } from "@/lib/context/auth-context"
import { useLoginPrompt } from "@/lib/context/login-prompt-context"
import type { CompletionLikeMeta } from "@/lib/api/explore-data"
import { formatCount } from "@/lib/project/format-count"
import { useRelativeTimeLabel } from "@/hooks/use-relative-time-label"
import {
  getStageTagTone,
  parseExplorationRecordNotes,
  resolveRecordTypeLabel,
  resolveStageLabel,
} from "@/lib/project/exploration-record-meta"
import { explorationRecordDomId } from "@/lib/project/exploration-record-links"
import { cn } from "@/lib/utils"
import type { Comment, ProjectCompletion } from "@/lib/mappers/types"

const STAGE_TONE_CLASS: Record<string, string> = {
  green: "bg-[hsl(var(--brand-green)/0.12)] text-[hsl(var(--brand-green))]",
  mint: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  blue: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  purple: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
}

export function ExplorationRecordFeedCard({
  completion,
  highlighted = false,
  initialLikeMeta,
  commentPreviews,
  variant = "standalone",
}: {
  completion: ProjectCompletion
  highlighted?: boolean
  initialLikeMeta?: CompletionLikeMeta
  commentPreviews?: Comment[]
  /** nested：组内帖子，不重复展示作者头 */
  variant?: "standalone" | "nested"
}) {
  const isNested = variant === "nested"
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const queryClient = useQueryClient()
  const [commentsOpen, setCommentsOpen] = useState(false)

  const parsed = parseExplorationRecordNotes(completion.notes)
  const stageLabel = resolveStageLabel(completion)
  const stageTone = stageLabel ? getStageTagTone(stageLabel) : null
  const recordTypeLabel = resolveRecordTypeLabel(completion) ?? "探索记录"
  const relativeTime = useRelativeTimeLabel(
    completion.completedAtIso,
    completion.completedAt ?? "",
  )
  const images = completion.proofImages ?? []
  const isFinal = completion.recordKind === "final"

  const defaultLikeMeta: CompletionLikeMeta = {
    count: completion.likes || 0,
    isLiked: false,
  }
  const commentsCount = completion.commentsCount ?? 0

  const hasServerLikeMeta = initialLikeMeta !== undefined
  const [likeMeta, setLikeMeta] = useState<CompletionLikeMeta>(initialLikeMeta ?? defaultLikeMeta)

  useEffect(() => {
    if (initialLikeMeta) {
      setLikeMeta(initialLikeMeta)
    }
  }, [initialLikeMeta])

  const { data: likeStats } = useQuery({
    queryKey: ["completion_likes", completion.id, user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/completions/${completion.id}/likes`)
      if (!response.ok) throw new Error(await response.text())
      return (await response.json()) as CompletionLikeMeta
    },
    enabled: !hasServerLikeMeta,
    staleTime: 0,
    refetchOnMount: true,
  })

  const likeMutation = useMutation({
    mutationFn: async (isLiked: boolean) => {
      const response = await fetch(`/api/completions/${completion.id}/likes`, {
        method: isLiked ? "DELETE" : "POST",
      })
      if (!response.ok) throw new Error(await response.text())
    },
    onMutate: (currentlyLiked) => {
      if (hasServerLikeMeta) {
        setLikeMeta((prev) => ({
          count: Math.max(0, prev.count + (currentlyLiked ? -1 : 1)),
          isLiked: !currentlyLiked,
        }))
      }
    },
    onError: () => {
      if (hasServerLikeMeta && initialLikeMeta) {
        setLikeMeta(initialLikeMeta)
      }
    },
    onSuccess: () => {
      if (!hasServerLikeMeta) {
        queryClient.invalidateQueries({ queryKey: ["completion_likes", completion.id, user?.id] })
      }
    },
  })

  const resolvedLikeMeta = hasServerLikeMeta ? likeMeta : (likeStats ?? defaultLikeMeta)
  const likesCount = resolvedLikeMeta.count ?? completion.likes ?? 0
  const isLiked = resolvedLikeMeta.isLiked ?? false

  const handleLike = () => {
    if (!user) {
      promptLogin(() => likeMutation.mutate(isLiked), { title: "登录以点赞", description: "登录后即可为探索记录点赞" })
      return
    }
    likeMutation.mutate(isLiked)
  }

  return (
    <>
      <article
        id={explorationRecordDomId(completion.id)}
        className={cn(
          "transition-shadow duration-500",
          isNested
            ? "bg-transparent p-3.5"
            : "surface-card rounded-md p-3.5",
          highlighted &&
            (isNested
              ? "bg-[hsl(var(--brand-green)/0.06)] ring-1 ring-inset ring-[hsl(var(--brand-green)/0.35)]"
              : "border-[hsl(var(--brand-green)/0.55)] ring-2 ring-[hsl(var(--brand-green)/0.35)] shadow-md shadow-[hsl(var(--brand-green)/0.12)]"),
        )}
      >
        {isNested ? (
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground/90">{relativeTime}</span>
            <span>·</span>
            <span>{recordTypeLabel}</span>
            {isFinal ? (
              <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                作品
              </span>
            ) : (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                过程
              </span>
            )}
          </div>
        ) : (
        <header className="flex items-start gap-2.5">
          <ExplorationRecordAvatar completion={completion} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-sm font-bold text-foreground">{completion.author}</p>
              {completion.authorLevel ? (
                <span className="rounded-full bg-[hsl(var(--tone-tech-soft))] px-1.5 py-0.5 text-[10px] font-bold text-[hsl(var(--tone-tech))]">
                  Lv.{completion.authorLevel}
                </span>
              ) : null}
              {isFinal ? (
                <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                  作品
                </span>
              ) : (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  过程
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {relativeTime}
              <span className="mx-1">·</span>
              {recordTypeLabel}
            </p>
          </div>
        </header>
        )}

        {parsed.body ? (
          <p className={cn("text-sm leading-6 text-foreground", isNested ? "mt-2" : "mt-3")}>{parsed.body}</p>
        ) : null}

        {images.length > 0 ? (
          <div className="relative mt-3">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden">
              {images.map((src, index) => (
                <div
                  key={`${src}-${index}`}
                  className={cn(
                    "relative shrink-0 overflow-hidden rounded-sm bg-muted",
                    images.length === 1 ? "h-44 w-full" : "h-28 w-28",
                  )}
                >
                  <OptimizedImage src={src} alt="" fill variant="grid" className="object-cover" />
                </div>
              ))}
            </div>
            {stageLabel && stageTone ? (
              <span
                className={cn(
                  "absolute bottom-2 left-2 rounded-xs px-2 py-0.5 text-[10px] font-semibold",
                  STAGE_TONE_CLASS[stageTone] ?? STAGE_TONE_CLASS.green,
                )}
              >
                阶段：{stageLabel}
              </span>
            ) : null}
          </div>
        ) : stageLabel && stageTone ? (
          <span
            className={cn(
              "mt-3 inline-flex rounded-xs px-2 py-0.5 text-[10px] font-semibold",
              STAGE_TONE_CLASS[stageTone] ?? STAGE_TONE_CLASS.green,
            )}
          >
            阶段：{stageLabel}
          </span>
        ) : null}

        <div className="mt-3 flex items-center gap-5 border-t border-[hsl(var(--surface-border)/0.7)] pt-2.5 text-xs font-medium text-muted-foreground">
          <button type="button" onClick={handleLike} className={cn("inline-flex items-center gap-1", isLiked && "text-red-500")}>
            <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />
            {formatCount(likesCount)}
          </button>
          <button type="button" onClick={() => setCommentsOpen(true)} className="inline-flex items-center gap-1">
            <MessageCircle className="h-4 w-4" />
            {formatCount(commentsCount)}
          </button>
          {isFinal ? (
            <Link
              href={`/works/${completion.id}`}
              aria-label={`查看 ${completion.author} 的作品详情`}
              className="ml-auto inline-flex h-8 items-center gap-0.5 rounded-full px-2 font-semibold text-[hsl(var(--brand-green))] transition-colors hover:bg-[hsl(var(--brand-green)/0.08)]"
            >
              查看作品详情
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ) : null}
        </div>

        {commentsCount > 0 ? (
          <CompletionRecordCommentsPreview
            completionId={completion.id}
            total={commentsCount}
            previewComments={commentPreviews}
            onExpand={() => setCommentsOpen(true)}
          />
        ) : null}
      </article>

      <Sheet open={commentsOpen} onOpenChange={setCommentsOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-lg">
          <SheetHeader>
            <SheetTitle>评论 ({commentsCount})</SheetTitle>
          </SheetHeader>
          <CompletionRecordComments completionId={completion.id} enabled={commentsOpen} className="mt-4" />
        </SheetContent>
      </Sheet>
    </>
  )
}

function ExplorationRecordAvatar({ completion }: { completion: ProjectCompletion }) {
  return (
    <UserAvatar
      userId={completion.userId}
      name={completion.author}
      src={completion.avatar}
      avatarFrameId={completion.avatarFrameId}
      className="h-9 w-9 bg-[hsl(var(--brand-green)/0.1)]"
    />
  )
}
