import Link from 'next/link'
import { ArrowRight, Compass } from 'lucide-react'

import type { Project } from '@/lib/mappers/types'
import { Button } from '@/components/ui/button'
import { DifficultyStars } from '@/components/ui/difficulty-stars'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { cn } from '@/lib/utils'

type ContinuationKind = 'next' | 'related' | 'back'

interface ProjectContinuationCardProps {
  kind: ContinuationKind
  href: string
  project?: Project | null
  compact?: boolean
  className?: string
}

const COPY = {
  next: {
    kicker: '继续看下一个项目',
    buttonLabel: '前往下一个项目',
  },
  related: {
    kicker: '继续探索这个方向',
    buttonLabel: '查看推荐项目',
  },
  back: {
    kicker: '返回探索',
    buttonLabel: '返回探索页',
  },
} as const

export function ProjectContinuationCard({ kind, href, project, compact = false, className }: ProjectContinuationCardProps) {
  const copy = COPY[kind]

  return (
    <section className={cn(
      "overflow-hidden border border-border/70 bg-card/85 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.22)] backdrop-blur-sm",
      compact ? "rounded-[18px]" : "rounded-[28px]",
      className,
    )}>
      <div className={cn(
        "border-b border-border/60 bg-gradient-to-r from-primary/8 via-background to-secondary/20",
        compact ? "px-5 py-4" : "px-5 py-5 sm:px-7",
      )}>
        <p className="section-kicker">{copy.kicker}</p>
      </div>

      <div className={compact ? "px-5 py-5" : "px-5 py-6 sm:px-7 sm:py-7"}>
        {project ? (
          <div className={cn(
            "grid gap-5 border border-border/70 bg-background/80 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.24)]",
            compact ? "rounded-[16px] p-3.5" : "rounded-[24px] p-4 sm:p-5 md:grid-cols-[220px_minmax(0,1fr)]",
          )}>
            <div className={cn(
              "relative aspect-[16/10] overflow-hidden bg-muted",
              compact ? "rounded-[12px]" : "rounded-[22px]",
            )}>
              <OptimizedImage
                src={project.image}
                alt={project.title}
                fill
                variant="card"
                className="object-cover"
              />
            </div>

            <div className="flex min-w-0 flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                  {project.category ? (
                    <span className="inline-flex items-center rounded-full bg-primary/8 px-3 py-1 text-primary">
                      {project.category}
                    </span>
                  ) : null}
                  {project.sub_category ? (
                    <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-muted-foreground">
                      {project.sub_category}
                    </span>
                  ) : null}
                  {project.difficulty_stars ? <DifficultyStars stars={project.difficulty_stars} size="sm" /> : null}
                </div>

                <div>
                  <h3 className={compact ? "text-base font-bold leading-snug tracking-tight" : "text-xl font-semibold tracking-tight sm:text-2xl"}>{project.title}</h3>
                  <p className={cn(
                    "mt-3 line-clamp-3 text-sm text-muted-foreground",
                    compact ? "leading-6" : "leading-7",
                  )}>
                    {project.description || '继续看看这个实践项目，找找下一步想动手的方向。'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link href={href}>
                  <Button className={cn("gap-2", compact ? "h-9 rounded-[8px]" : "rounded-full")}>
                    {copy.buttonLabel}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <span className="text-xs text-muted-foreground">
                  {project.author ? `作者：${project.author}` : '继续浏览更多项目'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className={cn(
            "flex flex-col items-start gap-4 border border-dashed border-border/70 bg-background/65 px-5 py-6",
            compact ? "rounded-[16px]" : "rounded-[24px] sm:px-6",
          )}>
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Compass className="h-5 w-5" />
            </div>
            <Link href={href}>
              <Button className={cn("gap-2", compact ? "h-9 rounded-[8px]" : "rounded-full")}>
                {copy.buttonLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
