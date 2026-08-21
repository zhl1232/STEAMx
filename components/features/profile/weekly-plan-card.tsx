'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronDown, ChevronRight, Circle } from 'lucide-react'

import {
  ProfileSpotIcon,
  type ProfileSpotIconName,
} from '@/components/features/profile/profile-spot-icons'
import type { GrowthTaskId } from '@/lib/profile/growth-tasks'
import type { WeeklyPlan, WeeklyPlanGrowthProgress, WeeklyPlanStepType } from '@/lib/profile/weekly-plan'
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
  const growthProgress = plan.growthProgress
  const [isExpanded, setIsExpanded] = useState(false)

  const isAllCompleted = totalSteps > 0 && plan.completedCount === totalSteps

  // 移动端折叠时：优先高亮待领取的奖励，其次高亮首个未完成的任务
  const claimableIndex = plan.steps.findIndex(
    (s) => s.status !== 'done' && s.type === 'reward' && s.growthTaskId,
  )
  const firstUnfinishedIndex = plan.steps.findIndex((s) => s.status !== 'done')
  const activeIndex = claimableIndex >= 0 ? claimableIndex : firstUnfinishedIndex >= 0 ? firstUnfinishedIndex : 0

  const visibleSteps =
    isMobile && !isExpanded && totalSteps > 1 ? [plan.steps[activeIndex]] : plan.steps

  return (
    <section
      className={cn(
        isMobile ? 'profile-mobile-panel p-4' : 'surface-panel overflow-hidden p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-base font-semibold text-foreground">{plan.title}</h2>
          {isAllCompleted ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[hsl(var(--brand-green)/0.12)] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--brand-green))]">
              <CheckCircle2 className="h-3 w-3" />
              已达成
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center">
          {isMobile && totalSteps > 1 ? (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--surface-muted)/0.6)] px-2 py-1 text-xs font-semibold text-foreground/80 transition hover:bg-[hsl(var(--surface-muted))] hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-label={isExpanded ? '收起任务清单' : '展开任务清单'}
            >
              <span>{isExpanded ? '收起清单' : `清单 ${plan.completedCount}/${totalSteps}`}</span>
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 transition-transform duration-200 text-muted-foreground',
                  isExpanded && 'rotate-180',
                )}
              />
            </button>
          ) : (
            <span className="shrink-0 rounded-full bg-[hsl(var(--brand-blue)/0.1)] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--brand-blue))]">
              {plan.completedCount}/{totalSteps}
            </span>
          )}
        </div>
      </div>

      {!isMobile && plan.subtitle ? (
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{plan.subtitle}</p>
      ) : null}

      {growthProgress ? <GrowthProgressRow progress={growthProgress} /> : null}

      <div
        className={cn(
          'mt-3 space-y-2 transition-all duration-200',
          !isMobile &&
          'rounded-md bg-[hsl(var(--surface-muted)/0.46)] p-3 ring-1 ring-[hsl(var(--surface-border)/0.58)] dark:bg-[hsl(var(--surface-muted)/0.28)]',
        )}
      >
        {visibleSteps.map((step, idx) => {
          const isDone = step.status === 'done'
          const canClaim = !isDone && step.type === 'reward' && step.growthTaskId && onClaim
          const isClaimPending = !!step.growthTaskId && claimPendingTaskId === step.growthTaskId
          const originalIndex = isMobile && !isExpanded ? activeIndex : idx
          const isFocusCard = !isDone && originalIndex === activeIndex

          return (
            <div
              key={step.id}
              className={cn(
                'grid grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-md transition-all duration-200',
                isFocusCard
                  ? 'border border-[hsl(var(--brand-blue)/0.25)] bg-[hsl(var(--brand-blue)/0.04)] p-2.5'
                  : isDone
                    ? 'bg-[hsl(var(--surface-muted)/0.4)] px-2.5 py-2 text-muted-foreground'
                    : 'bg-[hsl(var(--surface-raised)/0.5)] px-2.5 py-2 hover:bg-[hsl(var(--surface-muted)/0.5)]',
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
                  {isDone ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--brand-green))]" />
                  ) : (
                    <Circle className={cn('h-3.5 w-3.5 shrink-0', isFocusCard ? 'text-[hsl(var(--brand-blue))]' : 'text-[hsl(var(--brand-blue)/0.5)]')} />
                  )}
                  <p
                    className={cn(
                      'line-clamp-1 font-semibold leading-snug',
                      isFocusCard ? 'text-[13px] text-foreground font-bold' : isDone ? 'text-xs text-muted-foreground' : 'text-xs text-foreground',
                    )}
                  >
                    {step.title}
                  </p>
                  {isDone ? (
                    <span className="shrink-0 rounded-full bg-[hsl(var(--brand-green)/0.12)] px-1.5 py-0.2 text-[9.5px] font-bold text-[hsl(var(--brand-green))]">
                      已完成
                    </span>
                  ) : isFocusCard ? (
                    <span className="shrink-0 rounded-full bg-[hsl(var(--brand-blue)/0.12)] px-1.5 py-0.5 text-[9.5px] font-bold text-[hsl(var(--brand-blue))]">
                      当前焦点
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 line-clamp-1 text-[11px] leading-4 text-muted-foreground">{step.subtitle}</p>
              </div>

              {canClaim ? (
                <button
                  type="button"
                  disabled={isClaimPending}
                  className="inline-flex h-7 items-center justify-center rounded-md bg-[hsl(var(--brand-amber))] px-2.5 text-xs font-semibold text-white transition hover:brightness-105 active:scale-95"
                  onClick={() => onClaim(step.growthTaskId!)}
                >
                  {isClaimPending ? '领取中' : step.actionLabel}
                </button>
              ) : (
                <Link
                  href={step.href}
                  className={cn(
                    isFocusCard
                      ? 'inline-flex h-7 items-center justify-center rounded-md bg-[hsl(var(--brand-blue))] px-2.5 text-xs font-semibold text-white transition hover:bg-[hsl(var(--brand-blue)/0.9)] active:scale-95'
                      : isDone
                        ? 'inline-flex min-h-7 items-center justify-center px-2 text-[11px] font-semibold text-muted-foreground transition hover:text-foreground'
                        : 'inline-flex h-7 items-center justify-center rounded-md border border-border/80 bg-background/80 px-2.5 text-xs font-semibold text-foreground transition hover:bg-background active:scale-95',
                  )}
                >
                  {step.actionLabel}
                </Link>
              )}
            </div>
          )
        })}
      </div>

      {!isMobile || isExpanded || totalSteps <= 1 ? (
        <div className="mt-2.5 flex items-center justify-center pt-0.5">
          <Link
            href="/profile/timeline"
            className="group inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground/80 transition hover:text-[hsl(var(--brand-blue))]"
          >
            <span>查看完整成长足迹</span>
            <ChevronRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5 text-muted-foreground/60 group-hover:text-[hsl(var(--brand-blue))]" />
          </Link>
        </div>
      ) : null}
    </section>
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
