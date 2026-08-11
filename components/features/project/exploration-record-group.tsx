"use client"

import Link from "next/link"
import { ChevronRight, Heart, Layers3, MessageCircle } from "lucide-react"

import { OptimizedImage } from "@/components/ui/optimized-image"
import { useRelativeTimeLabel } from "@/hooks/use-relative-time-label"
import { formatCount } from "@/lib/project/format-count"
import type { ExplorationRecordGroup } from "@/lib/project/group-exploration-records"
import { explorationRecordDomId } from "@/lib/project/exploration-record-links"
import {
  parseExplorationRecordNotes,
  resolveRecordTypeLabel,
} from "@/lib/project/exploration-record-meta"
import { cn } from "@/lib/utils"

export function ExplorationRecordGroupCard({
  group,
  highlighted = false,
  currentUserId,
  isPartial = false,
}: {
  group: ExplorationRecordGroup
  highlighted?: boolean
  currentUserId?: string
  isPartial?: boolean
}) {
  const postCount = group.posts.length
  const hasFinal = Boolean(group.finalPost)
  const representative = group.representative
  const image = representative.proofImages[0]
  const parsed = parseExplorationRecordNotes(representative.notes)
  const latestTime = useRelativeTimeLabel(
    representative.completedAtIso,
    representative.completedAt,
  )
  const totalLikes = group.posts.reduce((sum, post) => sum + (post.likes || 0), 0)
  const totalComments = group.posts.reduce((sum, post) => sum + (post.commentsCount || 0), 0)
  const recordLabel = hasFinal
    ? "完成作品"
    : resolveRecordTypeLabel(representative) || "最新记录"
  const detailHref = `/works/${representative.id}`
  const canChooseFinal = currentUserId === group.userId && !hasFinal

  return (
    <section
      className={cn(
        "relative isolate rounded-md transition-shadow duration-500",
        highlighted && "ring-2 ring-[hsl(var(--brand-green)/0.35)]",
      )}
    >
      {group.posts.map((post) => (
        <span
          key={post.id}
          id={explorationRecordDomId(post.id)}
          className="pointer-events-none absolute inset-x-0 top-0"
          aria-hidden="true"
        />
      ))}

      {postCount > 2 ? (
        <span
          className="absolute inset-x-4 bottom-[-8px] top-4 -z-20 rounded-md border border-[hsl(var(--surface-border)/0.45)] bg-[hsl(var(--surface-muted))]"
          aria-hidden="true"
        />
      ) : null}
      {postCount > 1 ? (
        <span
          className="absolute inset-x-2 bottom-[-4px] top-2 -z-10 rounded-md border border-[hsl(var(--surface-border)/0.65)] bg-[hsl(var(--surface-raised))]"
          aria-hidden="true"
        />
      ) : null}

      <div className="overflow-hidden rounded-md border border-[hsl(var(--surface-border)/0.86)] bg-[hsl(var(--surface-raised))] shadow-xs">
        <Link
          href={detailHref}
          aria-label={`查看 ${group.author} 的完整探索详情`}
          className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--brand-green)/0.48)]"
        >
          <header className="flex items-center gap-2.5 px-3.5 py-3">
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[hsl(var(--brand-green)/0.1)]">
              {group.avatar ? (
                <OptimizedImage
                  src={group.avatar}
                  alt={group.author}
                  fill
                  variant="avatar"
                  className="object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-sm font-bold text-[hsl(var(--brand-green))]">
                  {group.author[0] || "?"}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-bold text-foreground">{group.author}</p>
                {group.authorLevel ? (
                  <span className="rounded-full bg-[hsl(var(--tone-tech-soft))] px-1.5 py-0.5 text-[10px] font-bold text-[hsl(var(--tone-tech))]">
                    Lv.{group.authorLevel}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{latestTime}</p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-1 text-[10px] font-bold",
                hasFinal
                  ? "bg-[hsl(var(--brand-green)/0.12)] text-[hsl(var(--brand-green))]"
                  : "bg-[hsl(var(--brand-amber)/0.12)] text-[hsl(var(--brand-amber))]",
              )}
            >
              {hasFinal ? "已完成" : "探索中"}
            </span>
          </header>

          <div className="relative mx-3.5 aspect-[16/10] overflow-hidden rounded-sm bg-[hsl(var(--surface-muted))]">
            {image ? (
              <OptimizedImage
                src={image}
                alt={`${group.author} 的${recordLabel}`}
                fill
                variant="grid"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
              />
            ) : (
              <div className="grid h-full place-items-center gap-1 text-muted-foreground">
                <Layers3 className="h-7 w-7" aria-hidden="true" />
                <span className="text-xs">这次探索还没有图片</span>
              </div>
            )}
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-[hsl(var(--surface-raised)/0.92)] px-2 py-1 text-[11px] font-bold text-foreground shadow-xs backdrop-blur-sm">
              <Layers3 className="h-3.5 w-3.5 text-[hsl(var(--brand-green))]" aria-hidden="true" />
              {postCount} 步{isPartial ? "（当前列表）" : "探索"}
            </span>
          </div>

          <div className="px-3.5 pb-3 pt-2.5">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
              <span>{recordLabel}</span>
              {representative.stageLabel ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{representative.stageLabel}</span>
                </>
              ) : null}
            </div>
            {parsed.body ? (
              <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-foreground/88">
                {parsed.body}
              </p>
            ) : null}

            <div className="mt-3 flex min-h-8 items-center gap-4 border-t border-[hsl(var(--surface-border)/0.65)] pt-2.5 text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3.5 w-3.5" aria-hidden="true" />
                {formatCount(totalLikes)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                {formatCount(totalComments)}
              </span>
              <span className="ml-auto inline-flex items-center gap-0.5 font-semibold text-[hsl(var(--brand-green))]">
                查看完整探索
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
              </span>
            </div>
          </div>
        </Link>

        {canChooseFinal ? (
          <div className="border-t border-[hsl(var(--surface-border)/0.7)] bg-[hsl(var(--brand-green)/0.045)] px-3.5 py-2.5">
            <Link
              href={`${detailHref}#exploration-process`}
              className="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold text-[hsl(var(--brand-green))]"
            >
              <span>已有一步完成了？选它作为完成作品</span>
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  )
}
