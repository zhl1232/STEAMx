'use client'

import Link from 'next/link'
import { ChevronRight, Compass, FolderOpen, Radar, Rocket } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { OptimizedImage } from '@/components/ui/optimized-image'
import type { ProfileNextAction } from '@/lib/profile/next-action'
import { cn } from '@/lib/utils'

const VARIANT_ICONS = {
  exploring: FolderOpen,
  vacuum: Rocket,
  timeline: Radar,
  explore: Compass,
} as const

type ProfileNextActionCardProps = {
  action: ProfileNextAction
  className?: string
}

export function ProfileNextActionCard({ action, className }: ProfileNextActionCardProps) {
  const Icon = VARIANT_ICONS[action.variant]
  const projectImage = action.project?.image
  const summary = action.subtitle

  return (
    <section className={cn('surface-panel overflow-hidden p-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">今日任务</h2>
          <span className="rounded-full bg-[hsl(var(--brand-blue)/0.1)] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--brand-blue))]">
            1/1
          </span>
        </div>
        {action.secondaryHref && action.secondaryLabel ? (
          <Link
            href={action.secondaryHref}
            className="inline-flex min-h-8 shrink-0 items-center gap-0.5 text-xs font-bold text-[hsl(var(--brand-blue))] transition hover:text-[hsl(var(--brand-blue)/0.82)]"
          >
            {action.secondaryLabel}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 rounded-md bg-[hsl(var(--surface-muted)/0.46)] p-3 ring-1 ring-[hsl(var(--surface-border)/0.58)] dark:bg-[hsl(var(--surface-muted)/0.28)]">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-[hsl(var(--tone-science-soft))]">
          {projectImage ? (
            <OptimizedImage src={projectImage} alt="" fill variant="thumbnail" className="object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-[hsl(var(--brand-blue))]">
              <Icon className="h-5 w-5" strokeWidth={2.3} />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="line-clamp-1 text-sm font-semibold leading-snug text-foreground">{action.title}</h3>
          <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-muted-foreground">{summary}</p>
        </div>
        <Button
          asChild
          className="h-9 shrink-0 rounded-md bg-[hsl(var(--brand-blue))] px-3 text-xs font-bold text-[hsl(var(--brand-blue-foreground))] shadow-[0_14px_28px_-20px_hsl(var(--brand-blue)/0.72)] hover:bg-[hsl(var(--brand-blue)/0.92)]"
        >
          <Link href={action.href}>
            {action.variant === 'vacuum' ? <Rocket className="mr-1.5 h-4 w-4" /> : null}
            {action.variant === 'exploring' ? <FolderOpen className="mr-1.5 h-4 w-4" /> : null}
            {action.actionLabel}
          </Link>
        </Button>
      </div>
    </section>
  )
}
