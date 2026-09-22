"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

import { visibleProjectTags } from "@/lib/project/tags"
import { cn } from "@/lib/utils"

const COLLAPSED_MAX_CHARS = 96

export function MobileProjectIntro({
  summary,
  tags = [],
  embedded = false,
}: {
  summary: string
  tags?: string[]
  embedded?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const visibleTags = visibleProjectTags(tags)
  const description = /^材料与步骤见正文[。.!！]?$/u.test(summary.trim()) ? "" : summary.trim()
  const needsExpand = description.length > COLLAPSED_MAX_CHARS

  if (!description && visibleTags.length === 0) return null

  return (
    <section className={cn(
      "scroll-mt-20 rounded-md border border-[hsl(var(--surface-border)/0.86)] bg-[hsl(var(--surface-raised)/0.94)] px-4 py-4 shadow-[0_18px_44px_-34px_hsl(var(--surface-shadow)/0.38)]",
      embedded && "border-0 bg-transparent px-0 py-0 shadow-none",
    )}>
      {!embedded ? <h2 className="mb-3 font-sans text-base font-bold tracking-tight text-foreground">项目简介</h2> : null}
      {visibleTags.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {visibleTags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex rounded-full border border-[hsl(var(--surface-border)/0.8)] bg-transparent px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
            >
              {tag}
            </span>
          ))}
          {visibleTags.length > 3 ? (
            <span className="inline-flex items-center px-1 text-[11px] font-medium text-muted-foreground">
              +{visibleTags.length - 3}
            </span>
          ) : null}
        </div>
      ) : null}
      {description ? <p
        className={cn(
          "whitespace-pre-line text-sm leading-6 text-muted-foreground",
          !expanded && needsExpand && "line-clamp-3",
        )}
      >
        {description}
      </p> : null}
      {needsExpand ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 inline-flex min-h-11 items-center gap-0.5 px-1 text-sm font-semibold text-[hsl(var(--brand-green))]"
        >
          {expanded ? "收起" : "展开"}
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
        </button>
      ) : null}
    </section>
  )
}
