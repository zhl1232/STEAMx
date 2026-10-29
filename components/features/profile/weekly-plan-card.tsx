'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'

import {
  ProfileSpotIcon,
  type ProfileSpotIconName,
} from '@/components/features/profile/profile-spot-icons'
import type { GrowthTaskId } from '@/lib/profile/growth-tasks'
import type { WeeklyPlan, WeeklyPlanGrowthProgress, WeeklyPlanStepType } from '@/lib/profile/weekly-plan'
import { Skeleton } from '@/components/ui/skeleton'
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
  embedded?: boolean
}

export function WeeklyPlanCard({
  plan,
  claimPendingTaskId,
  onClaim,
  className,
  variant = 'default',
  embedded = false,
}: WeeklyPlanCardProps) {
  const isMobile = variant === 'mobile'
  const isEmbedded = embedded || Boolean(className?.includes('border-0'))
  const totalSteps = plan.steps.length
  const growthProgress = plan.growthProgress
  const [isExpanded, setIsExpanded] = useState(false)

  // 默认只展示一个行动：优先待领取奖励，其次首个未完成任务。
  const claimableIndex = plan.steps.findIndex(
    (s) => s.status !== 'done' && s.type === 'reward' && s.growthTaskId,
  )
  const firstUnfinishedIndex = plan.steps.findIndex((s) => s.status !== 'done')
  const activeIndex = claimableIndex >= 0 ? claimableIndex : firstUnfinishedIndex >= 0 ? firstUnfinishedIndex : 0

  const visibleSteps =
    !isExpanded && totalSteps > 1 ? [plan.steps[activeIndex]] : plan.steps

  const Container = isEmbedded ? 'div' : 'section'

  return (
    <Container
      className={cn(
        !isEmbedded && (isMobile ? 'profile-mobile-panel p-4' : 'surface-panel overflow-hidden p-4'),
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-base font-semibold text-foreground">{plan.title}</h2>
        </div>

        <div className="flex shrink-0 items-center">
          {totalSteps > 1 ? (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? '收起探索建议' : '展开更多探索建议'}
            >
              <span>{isExpanded ? '收起' : '更多探索'}</span>
              <ChevronDown
                className={cn('h-4 w-4 transition-transform duration-200', isExpanded && 'rotate-180')}
              />
            </button>
          ) : null}
        </div>
      </div>

      {growthProgress ? <GrowthProgressRow progress={growthProgress} /> : null}

      <div className="mt-3 divide-y divide-border/50">
        {visibleSteps.map((step, idx) => {
          const isDone = step.status === 'done'
          const canClaim = !isDone && step.type === 'reward' && step.growthTaskId && onClaim
          const isClaimPending = !!step.growthTaskId && claimPendingTaskId === step.growthTaskId
          const originalIndex = !isExpanded ? activeIndex : idx
          const isFocusCard = !isDone && originalIndex === activeIndex

          return (
            <div
              key={step.id}
              className={cn(
                'grid items-center gap-x-3 gap-y-2 py-3',
                isFocusCard
                  ? 'grid-cols-[32px_minmax(0,1fr)] sm:grid-cols-[38px_minmax(0,1fr)_auto]'
                  : 'grid-cols-[28px_minmax(0,1fr)_auto]',
                isDone && 'text-muted-foreground',
              )}
            >
              <div className={cn(isFocusCard && 'p-0.5')}>
                <ProfileSpotIcon
                  name={STEP_ICONS[step.type]}
                  size="sm"
                  className={cn(isDone && 'opacity-60 saturate-50')}
                />
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p
                    className={cn(
                      'line-clamp-2 text-sm font-semibold leading-6',
                      isDone ? 'text-muted-foreground' : 'text-foreground',
                    )}
                  >
                    {step.title}
                  </p>
                  {isDone ? (
                    <span className="shrink-0 rounded-full bg-[hsl(var(--brand-green)/0.12)] px-1.5 py-0.5 text-xs font-medium text-[hsl(var(--brand-green))]">
                      已完成
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{step.subtitle}</p>
              </div>

              {canClaim ? (
                <button
                  type="button"
                  disabled={isClaimPending}
                  className={cn('inline-flex min-h-11 items-center justify-center rounded-md px-2.5 text-xs font-semibold transition disabled:opacity-60', isFocusCard ? 'col-span-2 col-start-1 bg-[hsl(var(--brand-amber))] text-white sm:col-span-1 sm:col-start-auto' : 'text-[hsl(var(--brand-blue))] hover:bg-muted')}
                  onClick={() => onClaim(step.growthTaskId!)}
                >
                  {isClaimPending ? '领取中' : step.actionLabel}
                </button>
              ) : (
                <Link
                  href={step.href}
                  className={cn(
                    isFocusCard
                      ? 'col-span-2 col-start-1 inline-flex min-h-11 items-center justify-center sm:col-span-1 sm:col-start-auto rounded-md bg-[hsl(var(--brand-blue))] px-2.5 text-xs font-semibold text-white transition hover:bg-[hsl(var(--brand-blue)/0.9)] active:scale-95'
                      : 'inline-flex min-h-11 items-center justify-end gap-0.5 whitespace-nowrap pl-1 text-xs font-medium text-muted-foreground transition hover:text-[hsl(var(--brand-blue))]',
                  )}
                >
                  {step.actionLabel}
                  {!isFocusCard ? <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
                </Link>
              )}
            </div>
          )
        })}
      </div>

      {isExpanded || totalSteps <= 1 ? (
        <div className="mt-2.5 flex items-center justify-center pt-0.5">
          <Link
            href="/profile/timeline"
            className="group inline-flex min-h-11 items-center gap-0.5 text-xs font-medium text-muted-foreground/80 transition hover:text-[hsl(var(--brand-blue))]"
          >
            <span>查看完整成长足迹</span>
            <ChevronRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5 text-muted-foreground/60 group-hover:text-[hsl(var(--brand-blue))]" />
          </Link>
        </div>
      ) : null}
    </Container>
  )
}

/** 引导任务不再单开面板，只在计划卡头部留一行「还剩几步毕业」的进度感 */
function GrowthProgressRow({ progress }: { progress: WeeklyPlanGrowthProgress }) {
  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0

  return (
    <div className="mt-3 flex items-center gap-3 rounded-md bg-[hsl(var(--brand-blue)/0.06)] px-3 py-2">
      <span className="shrink-0 text-xs font-semibold text-foreground">
        新手引导 {progress.completed}/{progress.total}
      </span>
      <div
        className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[hsl(var(--surface-muted))]"
        role="progressbar"
        aria-label="新手引导进度"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.completed}
      >
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--brand-green)),hsl(var(--brand-blue)))]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

export function WeeklyPlanCardSkeleton({
  className,
  variant = 'default',
  embedded = false,
}: {
  className?: string
  variant?: 'default' | 'mobile'
  embedded?: boolean
}) {
  const isMobile = variant === 'mobile'
  const isEmbedded = embedded || Boolean(className?.includes('border-0'))
  const Container = isEmbedded ? 'div' : 'section'

  return (
    <Container className={cn(!isEmbedded && (isMobile ? 'profile-mobile-panel p-4' : 'surface-panel p-4'), className)}>
      <div className="space-y-3">
        <Skeleton className="h-4 w-36 rounded-full max-w-full" />
        <div className="min-w-0 space-y-2">
          {[0].map((item) => (
            <div key={item} className="grid grid-cols-[40px_minmax(0,1fr)_64px] items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-md max-w-full" />
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-3 w-32 rounded-full max-w-full" />
                <Skeleton className="h-3 w-44 rounded-full max-w-full" />
              </div>
              <Skeleton className="h-11 rounded-md max-w-full" />
            </div>
          ))}
        </div>
      </div>
    </Container>
  )
}
