import Link from "next/link"
import { Heart, ImageOff, MessageCircle } from "lucide-react"

import { OptimizedImage } from "@/components/ui/optimized-image"
import type { Work } from "@/lib/mappers/types"
import { cn } from "@/lib/utils"

/** 四条产出路径的角标配色，与来源类型一一对应 */
const SOURCE_BADGE_CLASS: Record<string, string> = {
  course_lesson: "bg-[hsl(var(--brand-blue)/0.1)] text-[hsl(var(--brand-blue))]",
  project: "bg-[hsl(var(--brand-green)/0.12)] text-[hsl(var(--brand-green))]",
  challenge: "bg-[hsl(var(--tone-art)/0.14)] text-[hsl(var(--tone-art))]",
  observation: "bg-[hsl(var(--tone-math)/0.12)] text-[hsl(var(--tone-math))]",
}

export function workCardKey(work: Work) {
  return `${work.source?.type ?? "work"}:${work.id}`
}

export function WorkCardGrid({ works, className }: { works: Work[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 items-stretch gap-3 md:grid-cols-3 xl:grid-cols-4", className)}>
      {works.map((work, index) => <WorkCard key={workCardKey(work)} work={work} priority={index < 4} />)}
    </div>
  )
}

function describeSource(
  work: Work,
  title: string,
): { typeLabel: string; context: string; href: string; ariaLabel: string } {
  const source = work.source
  switch (source?.type) {
    case "course_lesson":
      return {
        typeLabel: "课程",
        context: source.courseTitle,
        href: `/works/${work.id}`,
        ariaLabel: `查看课程作品：${title}`,
      }
    case "challenge":
      return {
        typeLabel: "挑战",
        context: source.challengeTitle,
        href: source.href,
        ariaLabel: `查看挑战作品：${title}`,
      }
    case "observation":
      return {
        typeLabel: "观察",
        context: source.locationName || work.author,
        href: source.href,
        ariaLabel: `查看自然观察：${title}`,
      }
    default:
      return {
        typeLabel: "项目",
        context: work.author,
        href: `/works/${work.id}`,
        ariaLabel: `查看项目作品：${title}`,
      }
  }
}

export function WorkCard({ work, priority = false }: { work: Work; priority?: boolean }) {
  const source = work.source
  const image = work.proofImages[0]
  const title = source?.title || "作品"
  const { typeLabel, context, href, ariaLabel } = describeSource(work, title)

  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={ariaLabel}
      className="group flex h-full flex-col overflow-hidden rounded-md border border-border/80 bg-card shadow-xs transition duration-300 hover:-translate-y-0.5 hover:border-[hsl(var(--surface-border-strong))] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {image ? (
          <OptimizedImage
            src={image}
            alt={`${work.author} 的作品`}
            fill
            variant="grid"
            priority={priority}
            className="object-cover transition duration-500 group-hover:scale-[1.035]"
          />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground/60"><ImageOff className="h-8 w-8" /></div>
        )}
        {work.status !== "approved" ? (
          <span className={cn(
            "absolute right-2 top-2 rounded-xs px-2 py-1 text-[10px] font-semibold shadow-xs",
            work.status === "rejected" ? "bg-destructive text-destructive-foreground" : "bg-[hsl(var(--brand-amber))] text-[hsl(var(--brand-amber-foreground))]",
          )}>
            {work.status === "rejected" ? "未通过" : "审核中"}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5 px-3 pt-2.5 pb-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-xs px-1.5 py-0.5 text-[10px] font-semibold leading-none",
              SOURCE_BADGE_CLASS[source?.type ?? "project"] ?? SOURCE_BADGE_CLASS.project,
            )}
          >
            {typeLabel}
          </span>
          <h3 className="min-w-0 truncate text-sm font-bold leading-5 text-foreground">{title}</h3>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-muted-foreground/80">
            {context || "\u00a0"}
          </p>
          <div className="flex shrink-0 items-center gap-2.5 text-[11px] font-medium text-muted-foreground/75">
            <span className="inline-flex items-center gap-1 transition-colors hover:text-foreground" title="点赞数">
              <Heart className="h-3 w-3" />
              {work.likes}
            </span>
            <span className="inline-flex items-center gap-1 transition-colors hover:text-foreground" title="留言数">
              <MessageCircle className="h-3 w-3" />
              {work.commentsCount ?? 0}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
