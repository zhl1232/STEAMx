'use client'

import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { BookOpen, Sparkles } from 'lucide-react'

import { GrowthTaskRow } from '@/components/features/profile/growth-task-row'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { GrowthTaskId, ProfileGrowthTask } from '@/lib/profile/growth-tasks'

export function scrollToProfileBadges() {
  document.getElementById('profile-badges-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function GrowthTasksGraduatedCard({
  tasks,
  showSparkle,
  claimingTaskId,
  onClaim,
}: {
  tasks: ProfileGrowthTask[]
  showSparkle: boolean
  claimingTaskId: GrowthTaskId | null
  onClaim: (taskId: GrowthTaskId) => void
}) {
  const [showHistory, setShowHistory] = useState(false)
  const totalXpReward = useMemo(() => tasks.reduce((acc, t) => acc + t.rewardXp, 0), [tasks])

  return (
    <section className="surface-panel relative overflow-hidden rounded-[20px] p-6">
      <AnimatePresence>
        {showSparkle ? (
          <motion.div
            key="growth-grad-sparkle"
            className="pointer-events-none absolute right-5 top-5 text-[hsl(var(--brand-amber))]"
            initial={{ opacity: 0, scale: 0.65, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.35 }}
          >
            <Sparkles className="h-9 w-9 drop-shadow-md" aria-hidden />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[hsl(var(--brand-green)/0.12)] text-[hsl(var(--brand-green))]">
          <BookOpen className={cn('h-4 w-4')} strokeWidth={2.4} />
        </span>
        <h2 className="truncate text-base font-semibold text-foreground">成长任务 · 已全部完成</h2>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        累计 +{totalXpReward} 经验 · 解锁「探索启程」徽章
      </p>

      <div className="mt-4 flex flex-wrap gap-2" title={tasks.map((t) => t.label).join('、')}>
        {tasks.map((task) => (
          <span
            key={task.id}
            title={task.label}
            className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-[hsl(var(--brand-green))]"
          />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 rounded-lg border-[hsl(var(--brand-blue)/0.35)] text-xs font-bold text-[hsl(var(--brand-blue))]"
          onClick={() => scrollToProfileBadges()}
        >
          查看徽章
        </Button>
        <Button asChild size="sm" className="h-9 rounded-lg px-3 text-xs font-bold">
          <Link href="/community?tab=challenges">去挑战</Link>
        </Button>
      </div>

      <button
        type="button"
        className="mt-4 text-xs font-semibold text-[hsl(var(--brand-blue))] underline-offset-2 hover:underline"
        onClick={() => setShowHistory((v) => !v)}
      >
        {showHistory ? '收起完成记录' : '查看完成记录'}
      </button>

      {showHistory ? (
        <div className="mt-4 space-y-3 border-t border-[hsl(var(--surface-border))] pt-4">
          {tasks.map((task) => (
            <GrowthTaskRow
              key={task.id}
              task={task}
              claimPending={claimingTaskId === task.id}
              onClaim={onClaim}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
