'use client'

import type { ReactNode } from 'react'
import { CalendarDays, CheckCircle2, Circle } from 'lucide-react'

import {
  getPlaceholderStudyCheckInDays,
  getStudyCheckInHint,
  getStudyCheckInMetricValue,
  getStudyCheckInStatusText,
  type ProfileStudyCheckInSummary,
  type StudyCheckInLoadState,
} from '@/lib/profile/study-checkin'
import { cn } from '@/lib/utils'

type StudyCheckInCardProps = {
  title?: ReactNode
  summary: ProfileStudyCheckInSummary | null
  state: StudyCheckInLoadState
  className?: string
}

function getStatusTone(state: StudyCheckInLoadState, summary: ProfileStudyCheckInSummary | null) {
  if (state === 'error' || !summary) {
    return 'border-[hsl(var(--surface-border-strong))] bg-[hsl(var(--surface-muted))] text-muted-foreground'
  }

  if (state === 'loading') {
    return 'border-[hsl(var(--surface-border-strong))] bg-[hsl(var(--surface-muted))] text-muted-foreground'
  }

  if (summary.todayCompleted) {
    return 'border-[hsl(var(--brand-green)/0.2)] bg-[hsl(var(--brand-green)/0.08)] text-[hsl(var(--brand-green))]'
  }

  if (summary.streak > 0) {
    return 'border-[hsl(var(--brand-amber)/0.2)] bg-[hsl(var(--brand-amber)/0.12)] text-[hsl(var(--brand-amber))]'
  }

  return 'border-[hsl(var(--brand-blue)/0.2)] bg-[hsl(var(--brand-blue)/0.08)] text-[hsl(var(--brand-blue))]'
}

function getHintTone(state: StudyCheckInLoadState, summary: ProfileStudyCheckInSummary | null) {
  if (state === 'error' || !summary || state === 'loading') {
    return 'border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-muted)/0.72)] text-muted-foreground'
  }

  if (summary.todayCompleted) {
    return 'border-[hsl(var(--brand-green)/0.16)] bg-[hsl(var(--brand-green)/0.07)] text-[hsl(var(--brand-green))]'
  }

  if (summary.streak > 0) {
    return 'border-[hsl(var(--brand-amber)/0.2)] bg-[hsl(var(--brand-amber)/0.1)] text-[hsl(var(--brand-amber))]'
  }

  return 'border-[hsl(var(--brand-blue)/0.16)] bg-[hsl(var(--brand-blue)/0.07)] text-[hsl(var(--brand-blue))]'
}

export function StudyCheckInCard({ title, summary, state, className }: StudyCheckInCardProps) {
  const visibleDays = state === 'ready' && summary?.days.length ? summary.days : getPlaceholderStudyCheckInDays()
  const metric = getStudyCheckInMetricValue(state, summary)
  const statusText = getStudyCheckInStatusText(state, summary)
  const hint = getStudyCheckInHint(state, summary)
  const hintTone = getHintTone(state, summary)
  const statusTone = getStatusTone(state, summary)

  return (
    <section className={cn('surface-panel flex flex-col rounded-lg p-6', className)}>
      {title || <h2 className="text-base font-semibold text-foreground">探索打卡</h2>}

      <div className="mt-4 rounded-lg bg-[linear-gradient(135deg,#f4fbf7,#eef7ff)] p-4 dark:bg-[linear-gradient(135deg,hsl(var(--surface-muted)),hsl(var(--surface-raised)))]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-muted-foreground">连续探索</p>
              <span
                className={cn(
                  'inline-flex min-h-6 items-center rounded-full border px-2.5 text-[11px] font-bold',
                  statusTone,
                )}
              >
                {statusText}
              </span>
            </div>
            <div className="mt-2 flex items-end gap-1">
              <span className="text-[34px] font-extrabold leading-none text-[hsl(var(--brand-green))]">
                {metric.value}
              </span>
              {metric.suffix ? (
                <span className="pb-1 text-sm font-bold text-foreground">{metric.suffix}</span>
              ) : null}
            </div>
          </div>
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-white shadow-[0_16px_34px_-26px_rgba(27,96,54,0.62)] dark:bg-background/60">
            <CalendarDays className="h-9 w-9 text-[hsl(var(--brand-amber))]" />
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          只记录真实探索：完成项目、提交观察或挑战作品。
        </p>
      </div>

      <div className="mt-4 grid grid-cols-6 gap-2">
        {visibleDays.map((day, index) => {
          const isToday = index === visibleDays.length - 1
          const completed = state === 'ready' && Boolean(day.completed)

          return (
            <div key={`${day.date || 'placeholder'}-${day.label}-${index}`} className="text-center">
              <span
                className={cn(
                  'mx-auto grid h-7 w-7 place-items-center rounded-full border',
                  completed && isToday && 'border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green))] text-white',
                  completed && !isToday && 'border-[hsl(var(--brand-green)/0.22)] bg-[hsl(var(--brand-green)/0.12)] text-[hsl(var(--brand-green))]',
                  !completed && state === 'ready' && 'border-[hsl(var(--surface-border-strong))] bg-[hsl(var(--surface-muted))] text-muted-foreground',
                  state !== 'ready' && 'border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-muted)/0.82)] text-muted-foreground',
                )}
              >
                {completed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
              </span>
              <span className="mt-1 block text-[11px] font-medium text-muted-foreground">
                {isToday ? '今天' : day.label}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-auto pt-4">
        <div className={cn('rounded-sm border px-3 py-2.5', hintTone)}>
          <p className="text-xs font-bold">今日探索状态</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>
        </div>
      </div>
    </section>
  )
}
