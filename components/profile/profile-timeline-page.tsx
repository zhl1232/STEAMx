'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  Award,
  BookOpen,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Leaf,
  Loader2,
  Radar,
  Trophy,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { MobilePageHeader } from '@/components/ui/mobile-page-header'
import { logger } from '@/lib/logger'
import type { ProfileTimelineEvent, ProfileTimelineIconName, ProfileTimelineStatus } from '@/lib/profile/timeline'
import { cn } from '@/lib/utils'

type TimelinePayload = {
  events?: ProfileTimelineEvent[]
  hasMore?: boolean
  nextBefore?: string | null
  error?: string
}

type TimelineGroup = {
  dateKey: string
  dateLabel: string
  events: ProfileTimelineEvent[]
}

const TIMELINE_ICON_META: Record<ProfileTimelineIconName, { icon: LucideIcon; tone: string }> = {
  timeline: { icon: Radar, tone: 'bg-[hsl(var(--brand-blue)/0.12)] text-[hsl(var(--brand-blue))]' },
  projects: { icon: FolderOpen, tone: 'bg-[hsl(var(--brand-green)/0.12)] text-[hsl(var(--brand-green))]' },
  observation: { icon: Leaf, tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' },
  achievement: { icon: Trophy, tone: 'bg-[hsl(var(--brand-amber)/0.16)] text-[hsl(var(--brand-amber))]' },
  growth: { icon: BookOpen, tone: 'bg-violet-500/10 text-violet-600 dark:text-violet-300' },
}

const STATUS_TONE: Record<ProfileTimelineStatus, string> = {
  neutral: 'bg-[hsl(var(--surface-muted))] text-muted-foreground',
  pending: 'bg-[hsl(var(--brand-amber)/0.14)] text-[hsl(var(--brand-amber))]',
  approved: 'bg-[hsl(var(--brand-green)/0.12)] text-[hsl(var(--brand-green))]',
  rejected: 'bg-rose-500/10 text-rose-500',
}

function getEventTimeLabel(event: ProfileTimelineEvent) {
  return event.fullDateLabel.split(' ')[1] || event.fullDateLabel
}

function getEventDateKey(event: ProfileTimelineEvent) {
  return event.fullDateLabel.split(' ')[0] || event.dateLabel
}

function groupTimelineEvents(events: ProfileTimelineEvent[]): TimelineGroup[] {
  const groups: TimelineGroup[] = []
  const groupByDate = new Map<string, TimelineGroup>()

  for (const event of events) {
    const dateKey = getEventDateKey(event)
    const current = groupByDate.get(dateKey)

    if (current) {
      current.events.push(event)
      continue
    }

    const group = {
      dateKey,
      dateLabel: event.dateLabel,
      events: [event],
    }
    groupByDate.set(dateKey, group)
    groups.push(group)
  }

  return groups
}

function getTimelineSummary(events: ProfileTimelineEvent[]) {
  const activeDays = new Set(events.map(getEventDateKey))
  const xpTotal = events.reduce((sum, event) => sum + (event.xpAmount || 0), 0)
  const milestoneCount = events.filter((event) => event.kind === 'badge_unlocked' || event.kind === 'project_completed' || event.kind === 'challenge_completed').length

  return {
    activeDays: activeDays.size,
    xpTotal,
    milestoneCount,
  }
}

function TimelineIcon({ event }: { event: ProfileTimelineEvent }) {
  const meta = TIMELINE_ICON_META[event.iconName]
  const Icon = meta.icon

  return (
    <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-[14px] ring-1 ring-inset ring-white/50', meta.tone)}>
      <Icon className="h-[18px] w-[18px]" strokeWidth={2.5} />
    </span>
  )
}

function TimelineEventRow({ event }: { event: ProfileTimelineEvent }) {
  const content = (
    <article className="group relative grid min-h-[84px] grid-cols-[40px_minmax(0,1fr)] items-center gap-3 rounded-[14px] border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-muted)/0.44)] px-3.5 py-3 transition hover:border-[hsl(var(--brand-blue)/0.28)] hover:bg-[hsl(var(--surface-raised))] hover:shadow-sm md:grid-cols-[40px_minmax(0,1fr)_96px]">
      <TimelineIcon event={event} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 truncate text-[15px] font-semibold text-foreground">{event.label}</h2>
          {event.statusLabel ? (
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', STATUS_TONE[event.status])}>
              {event.statusLabel}
            </span>
          ) : null}
          {event.xpAmount ? (
            <span className="rounded-full bg-[hsl(var(--brand-blue)/0.1)] px-2 py-0.5 text-[11px] font-extrabold text-[hsl(var(--brand-blue))]">
              +{event.xpAmount} XP
            </span>
          ) : null}
        </div>
        <p className="mt-1 line-clamp-1 text-sm leading-5 text-muted-foreground">{event.detail}</p>
        <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground md:hidden">
          <CalendarCheck2 className="h-3.5 w-3.5" />
          {event.fullDateLabel}
        </div>
      </div>
      <div className="hidden items-center justify-end gap-2 text-right md:flex">
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">{getEventTimeLabel(event)}</span>
        {event.href ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-45 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
        ) : null}
      </div>
    </article>
  )

  return event.href ? (
    <Link href={event.href} className="block rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
      {content}
    </Link>
  ) : content
}

function TimelineOverview({
  events,
  latestEvent,
}: {
  events: ProfileTimelineEvent[]
  latestEvent?: ProfileTimelineEvent
}) {
  const summary = getTimelineSummary(events)
  const items = [
    { label: '记录', value: events.length.toString() },
    { label: '探索日', value: summary.activeDays.toString() },
    { label: '经验', value: `+${summary.xpTotal}` },
    { label: '里程碑', value: summary.milestoneCount.toString() },
  ]

  return (
    <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
      <section className="surface-panel rounded-[22px] p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-[16px] bg-[hsl(var(--brand-blue)/0.1)] text-[hsl(var(--brand-blue))]">
            <Radar className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">轨迹概览</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">来自真实作品、观察和奖励记录</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          {items.map((item) => (
            <div key={item.label} className="rounded-[14px] border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-muted)/0.48)] px-3 py-3">
              <div className="text-lg font-extrabold tabular-nums text-foreground">{item.value}</div>
              <div className="mt-0.5 text-xs font-medium text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      {latestEvent ? (
        <section className="surface-panel rounded-[22px] p-5">
          <p className="section-kicker">最新记录</p>
          <div className="mt-4 flex items-start gap-3">
            <TimelineIcon event={latestEvent} />
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-foreground">{latestEvent.label}</h2>
              <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{latestEvent.detail}</p>
              <p className="mt-3 text-xs font-semibold text-muted-foreground">{latestEvent.fullDateLabel}</p>
            </div>
          </div>
        </section>
      ) : null}
    </aside>
  )
}

export function ProfileTimelinePage() {
  const [events, setEvents] = useState<ProfileTimelineEvent[]>([])
  const [nextBefore, setNextBefore] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadTimeline = useCallback(async ({ before, append = false }: { before?: string | null; append?: boolean } = {}) => {
    if (append) {
      setIsLoadingMore(true)
    } else {
      setIsLoading(true)
    }
    setErrorMessage(null)

    const params = new URLSearchParams({ limit: '20' })
    if (before) {
      params.set('before', before)
    }

    try {
      const response = await fetch(`/api/profile/timeline?${params.toString()}`)
      const payload = (await response.json().catch(() => ({}))) as TimelinePayload

      if (!response.ok) {
        throw new Error(payload.error || '探索轨迹加载失败')
      }

      const nextEvents = payload.events || []
      setEvents((current) => (append ? [...current, ...nextEvents] : nextEvents))
      setHasMore(Boolean(payload.hasMore))
      setNextBefore(payload.nextBefore || null)
    } catch (error) {
      logger.error('Failed to load profile timeline page', { error })
      setErrorMessage(error instanceof Error ? error.message : '探索轨迹加载失败')
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    void loadTimeline()
  }, [loadTimeline])

  const latestEvent = events[0]
  const timelineGroups = groupTimelineEvents(events)

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <div className="md:hidden">
        <MobilePageHeader title="探索轨迹" fallbackHref="/profile" />
      </div>

      <div className="mx-auto w-full max-w-[1840px] px-4 py-6 min-[390px]:px-5 md:px-8 md:py-8">
        <section className="surface-panel overflow-hidden rounded-[22px]">
          <div className="flex items-start gap-4 px-5 py-5 md:px-6">
            <Button asChild variant="ghost" size="icon" className="hidden h-10 w-10 shrink-0 rounded-xl md:inline-flex">
              <Link href="/profile" aria-label="返回个人主页">
                <ChevronLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-[16px] bg-[hsl(var(--brand-blue)/0.1)] text-[hsl(var(--brand-blue))]">
                  <Award className="h-5 w-5" />
                </span>
                <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">探索轨迹</h1>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                按真实发生时间记录注册、作品、项目完成、挑战、自然观察、徽章和经验奖励。
              </p>
            </div>
            {latestEvent ? (
              <div className="hidden rounded-[14px] border border-[hsl(var(--surface-border))] px-4 py-3 text-right md:block">
                <div className="text-xs font-semibold text-muted-foreground">最新记录</div>
                <div className="mt-1 text-sm font-bold text-foreground">{latestEvent.dateLabel}</div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-5">
          {isLoading ? (
            <div className="surface-panel grid min-h-[260px] place-items-center rounded-[20px] text-sm font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在同步真实轨迹
              </span>
            </div>
          ) : errorMessage ? (
            <div className="surface-panel rounded-[20px] px-6 py-12 text-center">
              <h2 className="text-lg font-semibold text-foreground">探索轨迹加载失败</h2>
              <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
              <Button className="mt-5 rounded-full" onClick={() => loadTimeline()}>
                重新加载
              </Button>
            </div>
          ) : events.length === 0 ? (
            <div className="surface-panel rounded-[20px] px-6 py-14 text-center">
              <Radar className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h2 className="mt-4 text-lg font-semibold text-foreground">还没有探索轨迹</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">发布作品、完成项目或提交观察后会显示在这里。</p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
              <section className="surface-panel overflow-hidden rounded-[22px]">
                <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--surface-border))] px-5 py-4">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-foreground">真实记录</h2>
                    <p className="mt-1 text-xs text-muted-foreground">按发生时间倒序排列</p>
                  </div>
                  <span className="rounded-full bg-[hsl(var(--brand-blue)/0.1)] px-3 py-1 text-xs font-bold text-[hsl(var(--brand-blue))]">
                    {events.length} 条
                  </span>
                </div>

                <div className="divide-y divide-[hsl(var(--surface-border))]">
                  {timelineGroups.map((group) => (
                    <div key={group.dateKey} className="grid gap-3 px-4 py-4 md:grid-cols-[112px_minmax(0,1fr)] md:px-5">
                      <div className="md:pt-2">
                        <div className="text-lg font-extrabold tabular-nums text-foreground">{group.dateLabel}</div>
                        <div className="mt-0.5 text-xs font-semibold text-muted-foreground">{group.dateKey}</div>
                      </div>
                      <div className="space-y-2.5">
                        {group.events.map((event) => (
                          <TimelineEventRow key={event.id} event={event} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {hasMore ? (
                  <div className="border-t border-[hsl(var(--surface-border))] px-5 py-5">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-full px-5 sm:w-auto"
                      disabled={isLoadingMore || !nextBefore}
                      onClick={() => loadTimeline({ before: nextBefore, append: true })}
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          加载中
                        </>
                      ) : (
                        '加载更多'
                      )}
                    </Button>
                  </div>
                ) : null}
              </section>

              <TimelineOverview events={events} latestEvent={latestEvent} />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
