"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

const COLLAPSED_MAX_CHARS = 96

export function MobileProjectIntro({
  summary,
  tags = [],
}: {
  summary: string
  tags?: string[]
}) {
  const [expanded, setExpanded] = useState(false)
  const needsExpand = summary.length > COLLAPSED_MAX_CHARS

  return (
    <section className="scroll-mt-20 rounded-[14px] border border-[hsl(var(--surface-border)/0.86)] bg-[hsl(var(--surface-raised)/0.94)] px-4 py-4 shadow-[0_18px_44px_-34px_hsl(var(--surface-shadow)/0.38)]">
      <h2 className="mb-3 font-sans text-base font-bold tracking-tight text-foreground">项目简介</h2>
      {tags.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex rounded-full border border-[hsl(var(--surface-border)/0.8)] bg-transparent px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
            >
              {tag}
            </span>
          ))}
          {tags.length > 3 ? (
            <span className="inline-flex items-center px-1 text-[11px] font-medium text-muted-foreground">
              +{tags.length - 3}
            </span>
          ) : null}
        </div>
      ) : null}
      <p
        className={cn(
          "text-sm leading-6 text-muted-foreground",
          !expanded && needsExpand && "line-clamp-3",
        )}
      >
        {summary}
      </p>
      {needsExpand ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 inline-flex items-center gap-0.5 text-sm font-semibold text-[hsl(var(--brand-green))]"
        >
          {expanded ? "收起" : "展开"}
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
        </button>
      ) : null}
    </section>
  )
}
