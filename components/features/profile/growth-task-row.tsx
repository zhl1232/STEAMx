'use client'

import Link from 'next/link'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { GrowthTaskId, ProfileGrowthTask } from '@/lib/profile/growth-tasks'
import { cn } from '@/lib/utils'

type GrowthTaskRowProps = {
  task: ProfileGrowthTask
  claimPending?: boolean
  onClaim?: (taskId: GrowthTaskId) => void
  compact?: boolean
}

export function GrowthTaskRow({ task, claimPending = false, onClaim, compact = false }: GrowthTaskRowProps) {
  return (
    <div className={cn('surface-subtle flex items-start gap-3 transition hover:border-[hsl(var(--surface-border-strong))] hover:bg-[hsl(var(--surface-muted)/0.82)]', compact ? 'p-2.5' : 'p-3')}>
      <span className={cn('mt-0.5 text-[hsl(var(--brand-green))]', !task.done && 'text-muted-foreground')}>
        {task.done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <Link href={task.href} className="min-w-0 flex-1 rounded-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/30">
            <span className={cn('block font-semibold text-foreground', compact ? 'text-xs leading-5' : 'text-sm')}>{task.label}</span>
          </Link>
          <span className={cn('shrink-0 font-semibold text-[hsl(var(--brand-green))]', compact ? 'text-[11px]' : 'text-xs')}>{task.reward}</span>
        </div>

        <div className={cn('flex items-center gap-3', compact ? 'mt-1.5' : 'mt-2')}>
          <Link href={task.href} className="min-w-0 flex-1 rounded-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/30">
            <span className="block h-1.5 overflow-hidden rounded-full bg-[hsl(var(--surface-border))]">
              <span className="block h-full rounded-full bg-[hsl(var(--brand-blue))]" style={{ width: `${task.progress}%` }} />
            </span>
          </Link>

          {task.status === 'claimable' ? (
            <Button
              type="button"
              size="sm"
              className={cn('rounded-xs text-xs font-bold', compact ? 'h-7 px-2.5' : 'h-8 px-3')}
              disabled={claimPending}
              onClick={() => onClaim?.(task.id)}
            >
              {claimPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '领取'}
            </Button>
          ) : task.status === 'claimed' ? (
            <span className="w-14 shrink-0 text-right text-xs font-medium text-[hsl(var(--brand-green))]">已领取</span>
          ) : (
            <span className="w-14 shrink-0 text-right text-xs font-medium text-muted-foreground">{task.progressLabel}</span>
          )}
        </div>
      </div>
    </div>
  )
}
