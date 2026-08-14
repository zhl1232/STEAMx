"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, BookOpen, Coins, Flag, Heart, MessageCircle, Share2, Wrench } from "lucide-react"

import { CompletionRecordComments } from "@/components/features/project/completion-record-comments"
import { TipProjectDialog } from "@/components/features/project/tip-project-dialog"
import { WorkImageGallery } from "@/components/features/works/work-image-gallery"
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame"
import { Button } from "@/components/ui/button"
import { MobilePageHeader } from "@/components/ui/mobile-page-header"
import { OptimizedImage } from "@/components/ui/optimized-image"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/context/auth-context"
import { useLoginPrompt } from "@/lib/context/login-prompt-context"
import type { Work } from "@/lib/mappers/types"
import {
  parseExplorationRecordNotes,
  resolveRecordTypeLabel,
  resolveStageLabel,
} from "@/lib/project/exploration-record-meta"
import { cn } from "@/lib/utils"
import type { WorkJourneyRecord } from "@/lib/works/types"

type LikeMeta = { count: number; isLiked: boolean }

const ShareWorkDialog = dynamic(
  () => import("@/components/features/works/share-work-dialog").then((module) => module.ShareWorkDialog),
  { ssr: false },
)

export function WorkDetail({
  work,
  journeyRecords = [],
  journeyTotal,
  journeyHasMore = false,
  canShare,
  canPromote = false,
  autoOpenShare = false,
}: {
  work: Work
  journeyRecords?: WorkJourneyRecord[]
  journeyTotal?: number
  journeyHasMore?: boolean
  canShare: boolean
  canPromote?: boolean
  autoOpenShare?: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const queryClient = useQueryClient()
  const [tipOpen, setTipOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(autoOpenShare && canShare)
  const source = work.source

  useEffect(() => {
    if (autoOpenShare && canShare) setShareOpen(true)
  }, [autoOpenShare, canShare])

  const { data: likeMeta = { count: work.likes, isLiked: false } } = useQuery<LikeMeta>({
    queryKey: ["completion_likes", work.id, user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/completions/${work.id}/likes`)
      if (!response.ok) throw new Error("点赞状态加载失败")
      return response.json() as Promise<LikeMeta>
    },
    initialData: { count: work.likes, isLiked: false },
  })

  const { data: myTippedCompletion = 0 } = useQuery<number>({
    queryKey: ["tip_my", "completion", work.id],
    queryFn: async () => {
      const params = new URLSearchParams({
        resourceType: "completion",
        resourceId: String(work.id),
      })
      const response = await fetch(`/api/tips/my?${params.toString()}`)
      if (!response.ok) return 0
      const payload = await response.json()
      return (payload?.myTipped as number) ?? 0
    },
    enabled: Boolean(user?.id) && user?.id !== work.userId,
  })

  const likeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/completions/${work.id}/likes`, {
        method: likeMeta.isLiked ? "DELETE" : "POST",
      })
      if (!response.ok) throw new Error("点赞失败")
    },
    onMutate: async () => {
      const key = ["completion_likes", work.id, user?.id]
      await queryClient.cancelQueries({ queryKey: key })
      queryClient.setQueryData<LikeMeta>(key, {
        count: Math.max(0, likeMeta.count + (likeMeta.isLiked ? -1 : 1)),
        isLiked: !likeMeta.isLiked,
      })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["completion_likes", work.id] }),
  })

  const promoteMutation = useMutation({
    mutationFn: async (completionId: number) => {
      const response = await fetch(`/api/completions/${completionId}/promote`, {
        method: "POST",
      })
      const payload = (await response.json().catch(() => null)) as {
        id?: number
        error?: string
      } | null
      if (!response.ok || !payload?.id) {
        throw new Error(payload?.error || "暂时无法设为完成作品")
      }
      return { id: payload.id }
    },
    onSuccess: ({ id }) => {
      toast({
        title: "已设为完成作品",
        description: "原来的图片和记录都已保留。",
      })
      router.push(`/works/${id}?share=1`)
    },
    onError: (error) => {
      toast({
        title: "设置失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      })
    },
  })

  const handleLike = () => {
    if (!user) {
      promptLogin(handleLike, { title: "登录以点赞", description: "登录后即可支持这件作品" })
      return
    }
    likeMutation.mutate()
  }

  const effectiveJourneyRecords: WorkJourneyRecord[] = journeyRecords.length > 0
    ? journeyRecords
    : [{
        id: work.id,
        completedAt: work.completedAt,
        completedAtIso: work.completedAtIso,
        proofImages: work.proofImages,
        proofCaptions: work.proofCaptions,
        proofVideoUrl: work.proofVideoUrl,
        notes: work.notes,
        recordKind: work.recordKind,
        recordType: work.recordType,
        stageLabel: work.stageLabel,
      }]
  const chronologicalJourney = [...effectiveJourneyRecords].sort((first, second) =>
    (first.completedAtIso || "").localeCompare(second.completedAtIso || ""),
  )
  const effectiveJourneyTotal = Math.max(journeyTotal ?? 0, chronologicalJourney.length)
  const journeyHasFinal = chronologicalJourney.some((record) => record.recordKind === "final")
  const sourceLabel = source?.type === "course_lesson"
    ? "课程作品"
    : journeyHasFinal
      ? "项目作品"
      : "项目探索"
  const sourceBackLabel = source?.type === "project"
    ? "返回探索记录"
    : source?.type === "course_lesson"
      ? "返回课程课时"
      : "返回探索"
  const sourceContextLabel = source?.type === "course_lesson"
    ? "课程课时"
    : source?.type === "project"
      ? "项目"
      : "探索"
  const sourceActionLabel = source?.type === "project"
    ? "查看探索记录"
    : source?.type === "course_lesson"
      ? "打开课程课时"
      : "打开来源"
  const SourceIcon = source?.type === "course_lesson" ? BookOpen : Wrench
  const hasTippedCompletion = myTippedCompletion > 0
  const showJourney = chronologicalJourney.length > 1 || work.recordKind === "progress"
  const ownerCanPromote = canPromote && !journeyHasFinal

  return (
    <>
      <div className="md:hidden">
        <MobilePageHeader
          title={source?.title || "作品详情"}
          fallbackHref={source?.href || "/explore"}
          backLabel={sourceBackLabel}
          rightSlot={
            !journeyHasFinal ? (
              <span className="text-xs font-semibold text-[hsl(var(--brand-green))]">探索进行中</span>
            ) : null
          }
        />
      </div>

      <div className="page-shell pb-24 pt-4 md:py-8">
        <nav className="mb-5 hidden items-center justify-between gap-3 md:flex" aria-label="作品路径">
          <Button variant="ghost" asChild className="-ml-3 min-h-11 px-3">
            <Link href={source?.href || "/explore"}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {sourceBackLabel}
            </Link>
          </Button>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <SourceIcon className="h-4 w-4" />
            {source ? `来自${sourceContextLabel}` : sourceLabel}
          </span>
        </nav>

        <header className="mb-0 max-w-3xl md:mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden items-center rounded-full bg-[hsl(var(--brand-blue)/0.1)] px-2.5 py-1 text-xs font-semibold text-[hsl(var(--brand-blue))] md:inline-flex">
              作品详情
            </span>
            <span className="hidden items-center rounded-full bg-[hsl(var(--brand-green)/0.1)] px-2.5 py-1 text-xs font-semibold text-[hsl(var(--brand-green))] md:inline-flex">
              {journeyHasFinal ? "已完成探索" : "探索进行中"}
            </span>
          </div>
          <h1 className="sr-only font-bold tracking-tight text-foreground md:not-sr-only md:mt-3 md:text-3xl">
            {source?.title || "作品详情"}
          </h1>
          <p className="mt-2 hidden text-sm leading-6 text-muted-foreground md:block">
            {work.recordKind === "final"
              ? "把这次探索的成果留给下一次尝试。"
              : "沿着每一步记录，看看作品如何逐渐成形。"}
          </p>
        </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.8fr)] lg:gap-8 xl:gap-10">
        {showJourney ? (
          <WorkJourneyTimeline
            className="min-w-0 lg:col-start-1 lg:row-start-1"
            records={chronologicalJourney}
            currentWorkId={work.id}
            hasFinal={journeyHasFinal}
            totalCount={effectiveJourneyTotal}
            hasMore={journeyHasMore}
            canPromote={ownerCanPromote}
            promotingId={promoteMutation.isPending ? promoteMutation.variables : undefined}
            onPromote={(completionId) => promoteMutation.mutate(completionId)}
          />
        ) : (
          <section className="min-w-0 lg:col-start-1 lg:row-start-1" aria-label="作品媒体">
            <div className="surface-panel p-2 sm:p-3">
              <WorkImageGallery
                images={work.proofImages}
                captions={work.proofCaptions}
                alt={`${work.author} 的作品`}
                priority
                badge={work.proofImages.length > 0 ? "作品主图" : undefined}
              />

              {work.proofVideoUrl ? (
                <video
                  src={work.proofVideoUrl}
                  controls
                  playsInline
                  className="mt-4 w-full rounded-lg border border-border bg-black"
                />
              ) : null}
            </div>
          </section>
        )}

        <aside
          className={cn(
            "surface-panel space-y-4 p-4 sm:space-y-5 sm:p-5 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1",
            showJourney ? "lg:row-span-1" : "lg:row-span-2",
          )}
          aria-label="作品信息"
        >
          <div className="border-b border-border pb-5">
            <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-muted-foreground">作者与支持</p>
            <div className="flex items-center gap-3">
              <AvatarWithFrame
                src={work.avatar}
                alt={work.author}
                avatarFrameId={work.avatarFrameId}
                fallback={work.author[0] || "?"}
                className="h-12 w-12"
              />
              <div className="min-w-0 flex-1">
                <Link href={`/users/${work.userId}`} className="block truncate text-base font-bold text-foreground hover:underline">
                  {work.author}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">{work.completedAt}</p>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-0.5" role="group" aria-label="作品支持操作">
                <Button
                  type="button"
                  variant="ghost"
                  className={cn("h-11 min-w-11 px-2", likeMeta.isLiked && "text-red-500")}
                  onClick={handleLike}
                  disabled={likeMutation.isPending}
                  aria-label={likeMeta.isLiked ? `取消点赞，当前 ${likeMeta.count} 个赞` : `点赞，当前 ${likeMeta.count} 个赞`}
                >
                  <Heart className={cn("mr-1.5 h-4 w-4", likeMeta.isLiked && "fill-current")} />
                  <span className="tabular-nums">{likeMeta.count}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    "h-11 min-w-11 px-2",
                    hasTippedCompletion &&
                      "text-[hsl(var(--brand-amber))] hover:text-[hsl(var(--brand-amber))]",
                  )}
                  onClick={() => {
                    if (!user) {
                      promptLogin(() => setTipOpen(true), { title: "登录以投币", description: "登录后即可支持作品作者" })
                      return
                    }
                    setTipOpen(true)
                  }}
                  aria-label={
                    hasTippedCompletion
                      ? `已投币支持，当前 ${work.coins} 枚，我已投 ${myTippedCompletion} 枚`
                      : `投币支持，当前 ${work.coins} 枚`
                  }
                >
                  <Coins className="mr-1.5 h-4 w-4" />
                  <span className="tabular-nums">{work.coins}</span>
                </Button>
                {canShare ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 shrink-0"
                    onClick={() => setShareOpen(true)}
                    aria-label="分享作品"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          {source ? (
            <Link
              href={source.href}
              className="group grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3 rounded-lg border border-border bg-[hsl(var(--surface-muted)/0.5)] p-3 transition duration-200 hover:-translate-y-0.5 hover:border-[hsl(var(--surface-border-strong))] hover:shadow-sm"
            >
              <div className="relative h-16 overflow-hidden rounded-md bg-muted">
                {source.image ? (
                  <OptimizedImage src={source.image} alt="" fill variant="thumbnail" className="object-cover" />
                ) : (
                  <SourceIcon className="absolute inset-0 m-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 py-0.5">
                <p className="text-xs font-semibold text-muted-foreground">来自{sourceContextLabel}</p>
                <p className="mt-1 line-clamp-2 text-base font-bold leading-5 text-foreground group-hover:underline">
                  {source.title}
                </p>
                {source.type === "course_lesson" ? (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{source.courseTitle}</p>
                ) : null}
                <p className="mt-1 text-xs font-semibold text-[hsl(var(--brand-blue))]">{sourceActionLabel} →</p>
              </div>
            </Link>
          ) : null}

          {work.status !== "approved" ? (
            <div className="rounded-lg border border-[hsl(var(--brand-amber)/0.3)] bg-[hsl(var(--brand-amber)/0.1)] p-3 text-sm leading-6 text-foreground">
              {work.status === "rejected" ? `作品未通过：${work.rejectionReason || "请修改后重新提交"}` : "作品正在审核中，仅你自己可见。"}
            </div>
          ) : null}

          {!journeyHasFinal && source?.type === "project" ? (
            <div className="rounded-lg border border-[hsl(var(--brand-amber)/0.18)] bg-[hsl(var(--brand-amber)/0.09)] px-3 py-2.5 text-sm leading-6 text-foreground">
              <p className="font-semibold">这次探索还没有完成作品</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {ownerCanPromote
                  ? "如果某一步已经是最终成果，可以在探索过程中直接把它设为完成作品。"
                  : "作者仍在继续记录，当前步骤也可以正常查看和交流。"}
              </p>
            </div>
          ) : null}
        </aside>

        <section className="min-w-0 lg:col-start-1 lg:row-start-2">
          {work.notes?.trim() && !showJourney ? (
            <section className="surface-subtle mt-8 p-4 sm:p-5">
              <h2 className="text-xl font-bold text-foreground">创作记录</h2>
              <p className="mt-3 max-w-[70ch] whitespace-pre-wrap text-base leading-7 text-foreground/82">
                {work.notes}
              </p>
            </section>
          ) : null}

          <section className="surface-panel mt-8 p-4 sm:p-5" id="comments">
            <div className="mb-4 flex items-center gap-2 border-b border-border/70 pb-4">
              <MessageCircle className="h-5 w-5 text-[hsl(var(--brand-green))]" />
              <h2 className="text-xl font-bold text-foreground">留言与提问</h2>
            </div>
            <CompletionRecordComments completionId={work.id} />
          </section>
        </section>
      </div>

      <TipProjectDialog
        open={tipOpen}
        onOpenChange={setTipOpen}
        projectTitle={source?.title || "作品"}
        projectOwnerId={work.userId}
        projectId={work.id}
        resourceType="completion"
      />
      {canShare && shareOpen ? (
        <ShareWorkDialog work={work} open={shareOpen} onOpenChange={setShareOpen} />
      ) : null}
      </div>
    </>
  )
}

const journeyTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

function formatJourneyTime(record: WorkJourneyRecord) {
  if (!record.completedAtIso) return record.completedAt
  const date = new Date(record.completedAtIso)
  return Number.isNaN(date.getTime()) ? record.completedAt : journeyTimeFormatter.format(date)
}

function WorkJourneyTimeline({
  records,
  currentWorkId,
  hasFinal,
  totalCount,
  hasMore,
  canPromote,
  promotingId,
  onPromote,
  className,
}: {
  records: WorkJourneyRecord[]
  currentWorkId: number
  hasFinal: boolean
  totalCount: number
  hasMore: boolean
  canPromote: boolean
  promotingId?: number
  onPromote: (completionId: number) => void
  className?: string
}) {
  return (
    <section
      id="exploration-process"
      className={cn("surface-panel min-w-0 overflow-hidden scroll-mt-24 p-4 sm:p-5", className)}
      aria-labelledby="work-journey-heading"
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[hsl(var(--brand-green))]">
            {hasMore ? "最近记录（部分展示）" : hasFinal ? "从第一次记录到最终作品" : "按时间记录每一步"}
          </p>
          <h2 id="work-journey-heading" className="mt-1 text-xl font-bold text-foreground">探索过程</h2>
        </div>
        <span className="shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">
          {hasMore ? `最近 ${records.length} / ${totalCount} 条记录` : `${records.length} 条记录`}
        </span>
      </div>

      <ol className="mt-5 min-w-0 space-y-4" aria-label="按时间排列的探索记录">
        {records.map((record, index) => {
          const parsed = parseExplorationRecordNotes(record.notes)
          const isFinal = record.recordKind === "final"
          const isCurrent = record.id === currentWorkId
          const recordLabel = isFinal
            ? "最终作品"
            : resolveRecordTypeLabel(record) || `探索记录 ${index + 1}`
          const stageLabel = resolveStageLabel(record)

          return (
            <li key={record.id} className="grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)] gap-2.5 sm:grid-cols-[2rem_minmax(0,1fr)] sm:gap-3">
              <div className="relative flex justify-center" aria-hidden="true">
                {index < records.length - 1 ? (
                  <span className="absolute bottom-0 top-7 w-px bg-[hsl(var(--surface-border-strong)/0.7)]" />
                ) : null}
                <span
                  className={cn(
                    "relative z-10 grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold",
                    isFinal
                      ? "bg-[hsl(var(--brand-green))] text-[hsl(var(--brand-green-foreground))]"
                      : "bg-[hsl(var(--surface-muted))] text-foreground ring-1 ring-inset ring-border",
                  )}
                >
                  {isFinal ? <Flag className="h-3.5 w-3.5" /> : index + 1}
                </span>
              </div>

              <article
                className={cn(
                  "min-w-0 overflow-hidden rounded-lg border border-[hsl(var(--surface-border)/0.78)] bg-[hsl(var(--surface-muted)/0.44)] p-3 sm:p-4",
                  isCurrent && !isFinal && "border-[hsl(var(--brand-blue)/0.28)] bg-[hsl(var(--brand-blue)/0.05)]",
                  isFinal && "border-[hsl(var(--brand-green)/0.24)] bg-[hsl(var(--brand-green)/0.07)]",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <time
                    dateTime={record.completedAtIso}
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    {formatJourneyTime(record)}
                  </time>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      isFinal
                        ? "bg-[hsl(var(--brand-green)/0.14)] text-[hsl(var(--brand-green))]"
                        : "bg-muted text-foreground/75",
                    )}
                  >
                    {recordLabel}
                  </span>
                  {stageLabel ? (
                    <span className="text-[11px] text-muted-foreground">阶段：{stageLabel}</span>
                  ) : null}
                  {isCurrent ? (
                    <span className="text-[11px] font-semibold text-[hsl(var(--brand-green))]">
                      {isFinal ? "当前作品" : "当前记录"}
                    </span>
                  ) : null}
                </div>

                {parsed.body ? (
                  <p className="mt-2 max-w-[68ch] whitespace-pre-wrap text-sm leading-6 text-foreground/82">
                    {parsed.body}
                  </p>
                ) : null}

                {record.proofImages.length > 0 ? (
                  <div className="mt-3 min-w-0">
                    <WorkImageGallery
                      images={record.proofImages}
                      captions={record.proofCaptions}
                      alt={`${recordLabel}图片`}
                      priority={(index === 0 || isFinal)}
                      layout="feed"
                    />
                  </div>
                ) : null}

                {record.proofVideoUrl ? (
                  <video
                    src={record.proofVideoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="mt-3 max-h-72 w-full rounded-sm bg-black"
                  />
                ) : null}

                {canPromote && !isFinal ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-3 min-h-11 border-[hsl(var(--brand-green)/0.35)] text-[hsl(var(--brand-green))]"
                    onClick={() => onPromote(record.id)}
                    disabled={promotingId !== undefined}
                  >
                    <Flag className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    {promotingId === record.id ? "正在设置…" : "把这一步设为完成作品"}
                  </Button>
                ) : null}
              </article>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
