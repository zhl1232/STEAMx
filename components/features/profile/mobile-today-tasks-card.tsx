'use client'

import Link from 'next/link'
import { Award, ChevronRight, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { GROWTH_TASK_TOTAL, type GrowthTaskId, type ProfileGrowthTask } from '@/lib/profile/growth-tasks'
import { cn } from '@/lib/utils'

function pickFeaturedTask(tasks: ProfileGrowthTask[]) {
  return tasks.find((task) => task.status === 'claimable') ?? tasks.find((task) => task.status === 'in_progress') ?? null
}

type MobileTodayTasksCardProps = {
  tasks: ProfileGrowthTask[]
  completedTaskCount: number
  claimingTaskId: GrowthTaskId | null
  onClaim: (taskId: GrowthTaskId) => void
  className?: string
}

export function MobileTodayTasksCard({
  tasks,
  completedTaskCount,
  claimingTaskId,
  onClaim,
  className,
}: MobileTodayTasksCardProps) {
  const featuredTask = pickFeaturedTask(tasks)

  if (!featuredTask) {
    return (
      <section className={cn('profile-mobile-panel p-4', className)}>
        <MobileProfileSectionTitle title="今日任务" trailing={`${completedTaskCount}/${GROWTH_TASK_TOTAL}`} />
        <p className="mt-3 rounded-[14px] bg-[hsl(var(--surface-muted)/0.5)] px-3 py-4 text-center text-xs leading-5 text-muted-foreground">
          成长任务已全部完成，去社区挑战解锁更多成就吧。
        </p>
      </section>
    )
  }

  const actionLabel = featuredTask.status === 'claimable' ? '领取' : '去完成'

  return (
    <section className={cn('profile-mobile-panel p-4', className)}>
      <MobileProfileSectionTitle title="今日任务" trailing={`${completedTaskCount}/${GROWTH_TASK_TOTAL}`} />

      <div className="mt-3 flex items-center gap-3 rounded-[14px] bg-[hsl(var(--surface-muted)/0.42)] px-3 py-3 ring-1 ring-[hsl(var(--surface-border)/0.55)]">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-[hsl(var(--tone-art)/0.45)] bg-[hsl(var(--tone-art-soft))] text-[hsl(var(--tone-art))]">
          <Award className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 text-sm font-semibold text-foreground">{featuredTask.label}</h3>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{featuredTask.progressLabel}</p>
        </div>
        {featuredTask.status === 'claimable' ? (
          <Button
            type="button"
            disabled={claimingTaskId === featuredTask.id}
            onClick={() => onClaim(featuredTask.id)}
            className="profile-task-cta h-9 shrink-0 rounded-[22px] px-4 text-xs font-bold"
          >
            {claimingTaskId === featuredTask.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : actionLabel}
          </Button>
        ) : (
          <Button asChild className="profile-task-cta h-9 shrink-0 rounded-[22px] px-4 text-xs font-bold">
            <Link href={featuredTask.href}>{actionLabel}</Link>
          </Button>
        )}
      </div>
    </section>
  )
}

export function MobileProfileSectionTitle({
  title,
  actionHref,
  actionLabel,
  trailing,
}: {
  title: string
  actionHref?: string
  actionLabel?: string
  trailing?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-4 w-1 shrink-0 rounded-full bg-[hsl(var(--brand-blue))]" aria-hidden />
        <h2 className="truncate text-base font-semibold text-foreground">{title}</h2>
      </div>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="inline-flex min-h-8 shrink-0 items-center gap-0.5 text-xs font-semibold text-muted-foreground transition hover:text-[hsl(var(--brand-blue))]"
        >
          {actionLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      ) : trailing ? (
        <span className="inline-flex min-h-8 shrink-0 items-center gap-0.5 text-xs font-semibold text-muted-foreground">
          {trailing}
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      ) : null}
    </div>
  )
}
