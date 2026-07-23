'use client'

import Link from 'next/link'
import { CheckCircle2, Circle } from 'lucide-react'

import {
  ProfileSpotIcon,
  type ProfileSpotIconName,
} from '@/components/features/profile/profile-spot-icons'
import type { GrowthTaskId } from '@/lib/profile/growth-tasks'
import type { WeeklyPlan, WeeklyPlanStepType } from '@/lib/profile/weekly-plan'
import { cn } from '@/lib/utils'

const STEP_ICONS: Record<WeeklyPlanStepType, ProfileSpotIconName> = {
  reward: 'timeline-achievement',
  pbl: 'plan-pbl',
  exploring: 'timeline-projects',
  course: 'timeline-growth',
  radar: 'plan-radar',
  nature: 'timeline-observation',
  growth: 'growth-quest',
  project: 'timeline-projects',
  challenge: 'timeline-achievement',
  observation: 'timeline-observation',
  timeline: 'plan-xp',
  explore: 'exploring-map',
  playground: 'plan-playground',
}

type WeeklyPlanCardProps = {
  plan: WeeklyPlan
  claimPendingTaskId?: GrowthTaskId | null
  onClaim?: (taskId: GrowthTaskId) => void
  className?: string
  variant?: 'default' | 'mobile'
}

export function WeeklyPlanCard({
  plan,
  claimPendingTaskId,
  onClaim,
  className,
  variant = 'default',
}: WeeklyPlanCardProps) {
  const isMobile = variant === 'mobile'
  const totalSteps = plan.steps.length

  return (
    <section
      className={cn(
        isMobile ? 'profile-mobile-panel p-4' : 'surface-panel overflow-hidden p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">{plan.title}</h2>
            <span className="rounded-full bg-[hsl(var(--brand-blue)/0.1)] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--brand-blue))]">
              {plan.completedCount}/{totalSteps}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{plan.subtitle}</p>
        </div>
        <Link
          href="/profile/timeline"
          className="inline-flex min-h-11 shrink-0 items-center text-xs font-bold text-[hsl(var(--brand-blue))] transition hover:text-[hsl(var(--brand-blue)/0.82)]"
        >
          全部轨迹
        </Link>
      </div>

      <div
        className={cn(
          'mt-3 space-y-2',
          !isMobile &&
            'rounded-md bg-[hsl(var(--surface-muted)/0.46)] p-3 ring-1 ring-[hsl(var(--surface-border)/0.58)] dark:bg-[hsl(var(--surface-muted)/0.28)]',
        )}
      >
        {plan.steps.map((step) => {
          const isDone = step.status === 'done'
          const canClaim = !isDone && step.type === 'reward' && step.growthTaskId && onClaim
          const isClaimPending = !!step.growthTaskId && claimPendingTaskId === step.growthTaskId

          return (
            <div
              key={step.id}
              className={cn(
                'grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-1.5',
                isDone &&
                  'bg-[hsl(var(--surface-muted)/0.46)] text-muted-foreground dark:bg-[hsl(var(--surface-muted)/0.3)]',
              )}
            >
              <ProfileSpotIcon
                name={STEP_ICONS[step.type]}
                size="sm"
                className={cn(isDone && 'opacity-60 saturate-50')}
              />
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  {isDone ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--brand-green))]" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--brand-blue)/0.5)]" />
                  )}
                  <p
                    className={cn(
                      'line-clamp-1 text-sm font-semibold leading-snug',
                      isDone ? 'text-muted-foreground' : 'text-foreground',
                    )}
                  >
                    {step.title}
                  </p>
                  {isDone ? (
                    <span className="shrink-0 text-[10px] font-semibold text-[hsl(var(--brand-green))]">
                      已完成
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-muted-foreground">{step.subtitle}</p>
              </div>

              {canClaim ? (
                <button
                  type="button"
                  disabled={isClaimPending}
                  className="profile-soft-cta min-h-9 px-3 text-xs"
                  onClick={() => onClaim(step.growthTaskId!)}
                >
                  {isClaimPending ? '领取中' : step.actionLabel}
                </button>
              ) : (
                <Link
                  href={step.href}
                  className={cn(
                    isDone
                      ? 'inline-flex min-h-9 items-center justify-center px-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-blue)/0.25)]'
                      : 'profile-soft-cta min-h-9 px-3 text-xs',
                  )}
                >
                  {step.actionLabel}
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function WeeklyPlanCardSkeleton({ className, variant = 'default' }: { className?: string; variant?: 'default' | 'mobile' }) {
  const isMobile = variant === 'mobile'

  return (
    <section className={cn(isMobile ? 'profile-mobile-panel p-4' : 'surface-panel p-4', className)}>
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-36 rounded-full bg-[hsl(var(--surface-muted))]" />
        <div className="h-3 w-56 rounded-full bg-[hsl(var(--surface-muted))]" />
        <div className="space-y-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="grid grid-cols-[40px_minmax(0,1fr)_64px] items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-[hsl(var(--surface-muted))]" />
              <div className="space-y-2">
                <div className="h-3 w-32 rounded-full bg-[hsl(var(--surface-muted))]" />
                <div className="h-3 w-44 rounded-full bg-[hsl(var(--surface-muted))]" />
              </div>
              <div className="h-8 rounded-full bg-[hsl(var(--surface-muted))]" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
