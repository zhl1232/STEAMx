"use client"

import { OptimizedImage } from "@/components/ui/optimized-image"
import type { CompletionLikeMeta } from "@/lib/api/explore-data"
import type { Comment } from "@/lib/mappers/types"
import type { ExplorationRecordGroup } from "@/lib/project/group-exploration-records"
import { cn } from "@/lib/utils"

import { ExplorationRecordFeedCard } from "./exploration-record-feed-card"

export function ExplorationRecordGroupCard({
  group,
  highlightedId,
  likesMeta,
  commentPreviews,
}: {
  group: ExplorationRecordGroup
  highlightedId: number | null
  likesMeta: Record<number, CompletionLikeMeta>
  commentPreviews: Record<string, Comment[]>
}) {
  const postCount = group.posts.length
  const hasFinal = group.posts.some((p) => p.recordKind === "final")

  return (
    <section
      className={cn(
        "surface-card overflow-hidden rounded-[var(--radius-md)]",
        "bg-[hsl(var(--surface-raised)/0.94)] shadow-sm",
      )}
    >
      <header className="flex items-center gap-2.5 border-b border-[hsl(var(--surface-border)/0.7)] px-3.5 py-3">
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
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-bold text-foreground">{group.author}</p>
            {group.authorLevel ? (
              <span className="rounded-full bg-[hsl(var(--tone-tech-soft))] px-1.5 py-0.5 text-[10px] font-bold text-[hsl(var(--tone-tech))]">
                Lv.{group.authorLevel}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {postCount} 条探索记录
            {hasFinal ? " · 含提交作品" : ""}
          </p>
        </div>
      </header>

      <div className="divide-y divide-[hsl(var(--surface-border)/0.65)]">
        {group.posts.map((completion) => (
          <ExplorationRecordFeedCard
            key={completion.id}
            completion={completion}
            variant="nested"
            highlighted={highlightedId === completion.id}
            initialLikeMeta={likesMeta[completion.id]}
            commentPreviews={commentPreviews[String(completion.id)]}
          />
        ))}
      </div>
    </section>
  )
}
