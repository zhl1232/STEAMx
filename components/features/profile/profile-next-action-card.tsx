'use client'

import Link from 'next/link'
import { Award, ChevronRight, Compass, FolderOpen, Leaf, Radar, Rocket, Target } from 'lucide-react'

import { OptimizedImage } from '@/components/ui/optimized-image'
import type { ProfileNextAction } from '@/lib/profile/next-action'
import type { GrowthTaskId } from '@/lib/profile/growth-tasks'
import { cn } from '@/lib/utils'

const VARIANT_ICONS = {
  reward: Award,
  exploring: FolderOpen,
  growth: Target,
  radar: Radar,
  nature: Leaf,
  vacuum: Rocket,
  timeline: Radar,
  explore: Compass,
} as const

type ProfileNextActionCardProps = {
  action: ProfileNextAction
  claimPending?: boolean
  onClaim?: (taskId: GrowthTaskId) => void
  className?: string
}

export function ProfileNextActionCard({
  action,
  claimPending = false,
  onClaim,
  className,
}: ProfileNextActionCardProps) {
  const Icon = VARIANT_ICONS[action.variant]
  const projectImage = action.project?.image
  const summary = action.subtitle
  const canClaim = action.variant === 'reward' && action.growthTaskId && onClaim

  return (
    <section className={cn('surface-panel overflow-hidden p-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">今日任务</h2>
          <span className="rounded-full bg-[hsl(var(--brand-blue)/0.1)] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--brand-blue))]">
            {action.badgeLabel}
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
        {canClaim ? (
          <button
            type="button"
            disabled={claimPending}
            className="profile-action-cta"
            onClick={() => onClaim(action.growthTaskId!)}
          >
            <Award className="h-4 w-4" />
            {claimPending ? '领取中' : action.actionLabel}
          </button>
        ) : (
          <Link href={action.href} className="profile-action-cta">
            {action.variant === 'vacuum' ? <Rocket className="h-4 w-4" /> : null}
            {action.variant === 'exploring' ? <FolderOpen className="h-4 w-4" /> : null}
            {action.actionLabel}
          </Link>
        )}
      </div>
    </section>
  )
}
