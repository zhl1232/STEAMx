"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  History,
  Layers,
  ShieldCheck,
  Users,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type {
  SpeciesContributorSummary,
  SpeciesIdentifierSummary,
  SpeciesLifecycleAggregate,
  SpeciesMonthlyAggregate,
  SpeciesSexAggregate,
  SpeciesYearlyAggregate,
} from "@/lib/mappers/types"
import {
  formatObservationLifecycleStage,
  formatObservationSex,
} from "@/lib/observations/traits"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type StatsTab = "seasonality" | "history" | "lifecycle" | "sex"

interface SpeciesStatsPanelProps {
  totalObservationCount: number
  latestObservedAt: string | null
  topObservers: SpeciesContributorSummary[]
  topIdentifiers: SpeciesIdentifierSummary[]
  monthlyAggregates: SpeciesMonthlyAggregate[]
  yearlyAggregates: SpeciesYearlyAggregate[]
  lifecycleAggregates: SpeciesLifecycleAggregate[]
  sexAggregates: SpeciesSexAggregate[]
}

const MONTH_LABELS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]
const CHART_HEIGHT = 240

const TABS: ReadonlyArray<{ key: StatsTab; label: string; icon: typeof CalendarDays }> = [
  { key: "seasonality", label: "季节性", icon: CalendarDays },
  { key: "history", label: "历史记录", icon: History },
  { key: "lifecycle", label: "生命阶段", icon: Layers },
  { key: "sex", label: "性别", icon: BarChart3 },
]

function formatCount(value: number) {
  return value.toLocaleString("zh-CN")
}

function ContributorRanking<T extends { userId: string; displayName: string; avatarUrl?: string | null }>({
  title,
  icon,
  people,
  getCount,
  countLabel,
  emptyLabel,
}: {
  title: string
  icon: React.ReactNode
  people: T[]
  getCount: (person: T) => number
  countLabel: string
  emptyLabel: string
}) {
  return (
    <details className="group rounded-md border border-border/50 bg-background/70">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/35 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-1.5">
          {icon}
          <span className="truncate">{title}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-border/50 px-3 pb-3 pt-2">
        {people.length > 0 ? (
          <ol className="space-y-1.5 text-xs">
            {people.slice(0, 5).map((person, index) => (
              <li key={person.userId}>
                <Link
                  href={`/users/${person.userId}`}
                  className="flex items-center justify-between gap-2 rounded-sm px-1.5 py-1.5 transition-colors hover:bg-muted/55"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {index + 1}
                    </span>
                    <Avatar className="h-7 w-7 shrink-0 border border-border/60">
                      <AvatarImage src={person.avatarUrl ?? undefined} alt={person.displayName} />
                      <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
                        {person.displayName.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-foreground/85">{person.displayName}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {formatCount(getCount(person))} {countLabel}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-sm border border-dashed border-border/60 bg-background/45 px-3 py-4 text-center text-xs text-muted-foreground">
            {emptyLabel}
          </p>
        )}
      </div>
    </details>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/60 bg-background/40 px-4 py-6 text-center">
      <p className="text-sm text-muted-foreground">{children}</p>
      <p className="text-xs text-muted-foreground">数据由社区一起补充。</p>
    </div>
  )
}

export function SpeciesStatsPanel({
  totalObservationCount,
  topObservers,
  topIdentifiers,
  monthlyAggregates,
  yearlyAggregates,
  lifecycleAggregates,
  sexAggregates,
}: SpeciesStatsPanelProps) {
  const [tab, setTab] = useState<StatsTab>("seasonality")
  const chartFrameRef = useRef<HTMLDivElement | null>(null)
  const [chartWidth, setChartWidth] = useState(0)

  useEffect(() => {
    const element = chartFrameRef.current
    if (!element) return

    const updateWidth = (nextWidth: number) => {
      const normalizedWidth = Math.max(0, Math.floor(nextWidth))
      setChartWidth((currentWidth) => (currentWidth === normalizedWidth ? currentWidth : normalizedWidth))
    }

    updateWidth(element.getBoundingClientRect().width)

    if (typeof ResizeObserver === "undefined") {
      const handleResize = () => updateWidth(element.getBoundingClientRect().width)
      window.addEventListener("resize", handleResize)
      return () => window.removeEventListener("resize", handleResize)
    }

    const observer = new ResizeObserver((entries) => {
      updateWidth(entries[0]?.contentRect.width ?? 0)
    })
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  const monthlyChartData = monthlyAggregates.map((row) => ({
    label: MONTH_LABELS[row.month - 1],
    count: row.count,
  }))
  const yearlyChartData = yearlyAggregates.map((row) => ({
    label: String(row.year),
    count: row.count,
  }))
  const lifecycleChartData = lifecycleAggregates.map((row) => ({
    label: formatObservationLifecycleStage(row.stage) ?? row.stage,
    count: row.count,
  }))
  const sexChartData = sexAggregates.map((row) => ({
    label: formatObservationSex(row.sex) ?? row.sex,
    count: row.count,
  }))

  const hasMonthly = monthlyChartData.some((row) => row.count > 0)
  const hasYearly = yearlyChartData.length > 0
  const hasLifecycle = lifecycleChartData.length > 0
  const hasSex = sexChartData.length > 0
  const canRenderChart = chartWidth > 0

  if (totalObservationCount <= 0) {
    return null
  }

  return (
    <section className="surface-subtle relative isolate min-w-0 overflow-hidden rounded-lg bg-background/92 p-5 shadow-[0_20px_54px_-42px_hsl(var(--surface-shadow)/0.48)] sm:p-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold sm:text-xl">观测统计</h2>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <ContributorRanking
          icon={<Users className="h-3.5 w-3.5" />}
          title="观察过该物种的用户排行"
          people={topObservers}
          getCount={(person) => person.observationCount}
          countLabel="次观察"
          emptyLabel="暂无用户观察过该物种"
        />
        <ContributorRanking
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
          title="鉴定过该物种的用户排行"
          people={topIdentifiers}
          getCount={(person) => person.identificationCount}
          countLabel="次鉴定"
          emptyLabel="暂无用户鉴定过该物种"
        />
      </div>

      <div className="mt-5">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = key === tab
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-foreground text-background shadow-[0_10px_24px_-18px_rgba(15,23,42,0.8)]"
                    : "border border-border/70 bg-background/70 text-foreground/75 hover:border-primary/40 hover:bg-muted/50"
                }`}
                aria-pressed={active}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            )
          })}
        </div>

        <div ref={chartFrameRef} className="mt-4 h-[240px] min-w-0">
          {tab === "seasonality" ? (
            hasMonthly ? (
              canRenderChart ? (
                <LineChart width={chartWidth} height={CHART_HEIGHT} data={monthlyChartData} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 4" stroke="hsl(var(--border) / 0.4)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "3 3" }}
                    contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid hsl(var(--border))" }}
                    formatter={(value) => [`${formatCount(Number(value) || 0)} 次`, "观察"]}
                    labelFormatter={(label) => `${label}`}
                  />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 1.5, fill: "hsl(var(--background))" }} activeDot={{ r: 5 }} />
                </LineChart>
              ) : null
            ) : (
              <EmptyState>暂无按月聚合的观察数据。</EmptyState>
            )
          ) : null}

          {tab === "history" ? (
            hasYearly ? (
              canRenderChart ? (
                <BarChart width={chartWidth} height={CHART_HEIGHT} data={yearlyChartData} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 4" stroke="hsl(var(--border) / 0.4)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid hsl(var(--border))" }}
                    formatter={(value) => [`${formatCount(Number(value) || 0)} 次`, "观察"]}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" />
                </BarChart>
              ) : null
            ) : (
              <EmptyState>暂无历史聚合的观察数据。</EmptyState>
            )
          ) : null}

          {tab === "lifecycle" ? (
            hasLifecycle ? (
              canRenderChart ? (
                <BarChart width={chartWidth} height={CHART_HEIGHT} data={lifecycleChartData} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 4" stroke="hsl(var(--border) / 0.4)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid hsl(var(--border))" }}
                    formatter={(value) => [`${formatCount(Number(value) || 0)} 条`, "记录"]}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="hsl(var(--brand-amber))" />
                </BarChart>
              ) : null
            ) : (
              <EmptyState>暂未标注生命阶段。发布观察时可以一起标注。</EmptyState>
            )
          ) : null}

          {tab === "sex" ? (
            hasSex ? (
              canRenderChart ? (
                <BarChart width={chartWidth} height={CHART_HEIGHT} data={sexChartData} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 4" stroke="hsl(var(--border) / 0.4)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid hsl(var(--border))" }}
                    formatter={(value) => [`${formatCount(Number(value) || 0)} 条`, "记录"]}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="hsl(var(--brand-blue))" />
                </BarChart>
              ) : null
            ) : (
              <EmptyState>暂未标注性别。发布观察时可以一起标注。</EmptyState>
            )
          ) : null}
        </div>
      </div>
    </section>
  )
}
