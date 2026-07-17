import Link from "next/link"
import { BookOpen, Heart, ImageOff, MessageCircle, Wrench } from "lucide-react"

import { OptimizedImage } from "@/components/ui/optimized-image"
import type { Work } from "@/lib/mappers/types"
import { cn } from "@/lib/utils"

export function WorkCardGrid({ works, className }: { works: Work[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4", className)}>
      {works.map((work, index) => <WorkCard key={work.id} work={work} priority={index < 4} />)}
    </div>
  )
}

export function WorkCard({ work, priority = false }: { work: Work; priority?: boolean }) {
  const source = work.source
  const SourceIcon = source?.type === "course_lesson" ? BookOpen : Wrench
  const image = work.proofImages[0]

  return (
    <Link
      href={`/works/${work.id}`}
      prefetch={false}
      className="group block overflow-hidden rounded-md border border-border bg-card transition duration-300 hover:-translate-y-0.5 hover:border-[hsl(var(--surface-border-strong))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-xs bg-black/62 px-2 py-1 text-[10px] font-semibold text-white">
          <SourceIcon className="h-3 w-3" />
          {source?.type === "course_lesson" ? "课程" : "项目"}
        </span>
        {work.status !== "approved" ? (
          <span className={cn(
            "absolute right-2 top-2 rounded-xs px-2 py-1 text-[10px] font-semibold",
            work.status === "rejected" ? "bg-destructive text-destructive-foreground" : "bg-[hsl(var(--brand-amber))] text-[hsl(var(--brand-amber-foreground))]",
          )}>
            {work.status === "rejected" ? "未通过" : "审核中"}
          </span>
        ) : null}
      </div>
      <div className="flex min-h-[96px] flex-col gap-2 p-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-foreground">{source?.title || "探索作品"}</h3>
          {source?.type === "course_lesson" ? <p className="mt-1 truncate text-xs text-muted-foreground">{source.courseTitle}</p> : null}
        </div>
        <div className="mt-auto flex items-center gap-3 text-[11px] font-semibold text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{work.likes}</span>
          <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{work.commentsCount ?? 0}</span>
        </div>
      </div>
    </Link>
  )
}
