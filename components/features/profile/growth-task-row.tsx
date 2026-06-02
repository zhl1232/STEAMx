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
}

export function GrowthTaskRow({ task, claimPending = false, onClaim }: GrowthTaskRowProps) {
  return (
    <div className="surface-subtle flex items-start gap-3 p-3 transition hover:border-[hsl(var(--surface-border-strong))] hover:bg-[hsl(var(--surface-muted)/0.82)]">
      <span className={cn('mt-0.5 text-[hsl(var(--brand-green))]', !task.done && 'text-muted-foreground')}>
        {task.done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <Link href={task.href} className="min-w-0 flex-1 rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
            <span className="block text-sm font-semibold text-foreground">{task.label}</span>
          </Link>
          <span className="shrink-0 text-xs font-semibold text-[hsl(var(--brand-green))]">{task.reward}</span>
        </div>

        <div className="mt-2 flex items-center gap-3">
          <Link href={task.href} className="min-w-0 flex-1 rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
            <span className="block h-1.5 overflow-hidden rounded-full bg-[hsl(var(--surface-border))]">
              <span className="block h-full rounded-full bg-[hsl(var(--brand-blue))]" style={{ width: `${task.progress}%` }} />
            </span>
          </Link>

          {task.status === 'claimable' ? (
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-xs px-3 text-xs font-bold"
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
