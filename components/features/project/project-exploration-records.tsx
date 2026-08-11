"use client"

import type { KeyboardEvent, ReactNode } from "react"
import { ChevronRight, Heart, MessageCircle } from "lucide-react"
import Link from "next/link"

import { OptimizedImage } from "@/components/ui/optimized-image"
import { getExplorationRecordHref } from "@/lib/project/exploration-record-links"
import { formatCount } from "@/lib/project/format-count"
import { cn } from "@/lib/utils"
import type { ProjectCompletion } from "@/lib/mappers/types"

function ExplorationRecordCard({
  completion,
  projectId,
  className,
}: {
  completion: ProjectCompletion
  projectId: string | number
  className?: string
}) {
  const isWork = completion.recordKind === "final"
  const href = isWork ? `/works/${completion.id}` : getExplorationRecordHref(projectId, completion.id)

  const handleKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key === " ") {
      event.preventDefault()
      ;(event.currentTarget as HTMLAnchorElement).click()
    }
  }

  return (
    <Link
      href={href}
      onKeyDown={handleKeyDown}
      className={cn(
        "block overflow-hidden rounded-sm border border-[hsl(var(--surface-border)/0.86)] bg-background/86 shadow-xs shadow-[hsl(var(--surface-shadow)/0.06)]",
        "cursor-pointer transition-shadow hover:shadow-md hover:border-[hsl(var(--brand-green)/0.35)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-green)/0.45)]",
        className,
      )}
    >
      <article>
        <div className="p-2.5">
          <div className="mb-2 flex items-center gap-2">
            <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[hsl(var(--brand-green)/0.1)]">
              {completion.avatar ? (
                <OptimizedImage
                  src={completion.avatar}
                  alt={completion.author}
                  fill
                  variant="avatar"
                  className="object-cover"
                />
              ) : (
                <ExplorationRecordAvatarFallback author={completion.author} />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-foreground">{completion.author}</p>
              <p className="text-[10px] leading-3 text-muted-foreground">{completion.completedAt}</p>
            </div>
          </div>
          <div className="relative aspect-4/3 overflow-hidden rounded-sm bg-muted">
            {completion.proofImages[0] ? (
              <OptimizedImage
                src={completion.proofImages[0]}
                alt={`${completion.author} 的${isWork ? "作品" : "探索记录"}`}
                fill
                variant="grid"
                className="object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center text-xs text-muted-foreground">无图片</div>
            )}
          </div>
          <p className="mt-2 line-clamp-2 min-h-[36px] text-xs font-semibold leading-[18px] text-foreground">
            {completion.notes || "完成了这个项目，留下了一条探索记录。"}
          </p>
          <ExplorationRecordLikes likes={completion.likes || 0} />
          {isWork ? (
            <span className="mt-3 flex items-center justify-between gap-2 rounded-sm bg-[hsl(var(--brand-green)/0.08)] px-2.5 py-2 text-[11px] font-semibold text-[hsl(var(--brand-green))]">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">查看作品并留言</span>
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </span>
          ) : null}
        </div>
      </article>
    </Link>
  )
}

function ExplorationRecordAvatarFallback({ author }: { author: string }) {
  return (
    <div className="grid h-full w-full place-items-center text-xs font-bold text-[hsl(var(--brand-green))]">
      {author[0] || "?"}
    </div>
  )
}

function ExplorationRecordLikes({ likes }: { likes: number }) {
  return (
    <div className="mt-2 flex items-center gap-4 text-[11px] font-medium text-muted-foreground">
      <span className="inline-flex items-center gap-1 text-red-500">
        <Heart className="h-3.5 w-3.5 fill-current" />
        {formatCount(likes)}
      </span>
    </div>
  )
}

function ExplorationRecordsEmptyState() {
  return (
    <div className="app-empty-state py-8">
      <p className="text-sm font-semibold text-foreground">还没有探索记录</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">完成后上传作品，成为第一个记录的人。</p>
    </div>
  )
}

export function ProjectExplorationRecordsHorizontal({
  projectId,
  completions,
  limit = 6,
}: {
  projectId: string | number
  completions: ProjectCompletion[]
  limit?: number
}) {
  if (completions.length === 0) {
    return <ExplorationRecordsEmptyState />
  }

  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden">
      {completions.slice(0, limit).map((completion) => (
        <ExplorationRecordCard
          key={completion.id}
          projectId={projectId}
          completion={completion}
          className="min-w-[178px] snap-start"
        />
      ))}
    </div>
  )
}

export function ProjectExplorationRecordsBlock({
  projectId,
  completions,
  limit = 6,
  className,
  emptyActionSlot,
}: {
  projectId: string | number
  completions: ProjectCompletion[]
  limit?: number
  className?: string
  emptyActionSlot?: ReactNode
}) {
  const workCount = completions.filter((completion) => completion.recordKind === "final").length

  return (
    <div className={className}>
      <div className="mb-3 flex items-start gap-2.5 rounded-sm border border-[hsl(var(--brand-green)/0.2)] bg-[hsl(var(--brand-green)/0.06)] px-3 py-2.5">
        <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--brand-green))]" aria-hidden="true" />
        <p className="min-w-0 text-xs leading-5 text-muted-foreground">
          <span className="font-semibold text-foreground">想留言或提问？</span>{" "}
          {workCount > 0
            ? "打开下面的作品，在作品详情里交流。"
            : "暂时还没有作品；上传作品后，就可以在作品详情里留言和提问。"}
        </p>
      </div>
      <ProjectExplorationRecordsHorizontal
        projectId={projectId}
        completions={completions}
        limit={limit}
      />
      {completions.length === 0 && emptyActionSlot ? (
        <div className="mt-3">{emptyActionSlot}</div>
      ) : null}
      <Link
        href={`/project/${projectId}/records`}
        className="mt-3 flex items-center justify-center gap-1 text-sm font-semibold text-[hsl(var(--brand-green))]"
      >
        查看全部探索记录
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

export function ProjectExplorationRecordsList({
  projectId,
  completions,
}: {
  projectId: string | number
  completions: ProjectCompletion[]
}) {
  if (completions.length === 0) {
    return <ExplorationRecordsEmptyState />
  }

  return (
    <div className="space-y-3">
      {completions.map((completion) => (
        <ExplorationRecordCard
          key={completion.id}
          projectId={projectId}
          completion={completion}
        />
      ))}
    </div>
  )
}
