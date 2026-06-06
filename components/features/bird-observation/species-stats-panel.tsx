"use client"

import { useEffect, useRef, useState } from "react"
import {
  BarChart3,
  CalendarDays,
  History,
  Layers,
  ShieldCheck,
  Trophy,
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
  ObservationLifecycleStage,
  ObservationSex,
  SpeciesContributorSummary,
  SpeciesIdentifierSummary,
  SpeciesLifecycleAggregate,
  SpeciesMonthlyAggregate,
  SpeciesSexAggregate,
  SpeciesYearlyAggregate,
} from "@/lib/mappers/types"

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

const LIFECYCLE_LABELS: Record<ObservationLifecycleStage, string> = {
  egg: "卵",
  larva: "幼虫",
  pupa: "蛹",
  juvenile: "幼体",
  adult: "成体",
  unknown: "未注明",
}

const SEX_LABELS: Record<ObservationSex, string> = {
  male: "雄",
  female: "雌",
  unknown: "未注明",
}

const TABS: ReadonlyArray<{ key: StatsTab; label: string; icon: typeof CalendarDays }> = [
  { key: "seasonality", label: "季节性", icon: CalendarDays },
  { key: "history", label: "历史记录", icon: History },
  { key: "lifecycle", label: "生命阶段", icon: Layers },
  { key: "sex", label: "性别", icon: BarChart3 },
]

function formatCount(value: number) {
  return value.toLocaleString("zh-CN")
}

function formatDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  })
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/72 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function UserRankCard({
  icon,
  title,
  displayName,
  countLabel,
  avatarUrl,
}: {
  icon: React.ReactNode
  title: string
  displayName?: string
  countLabel: string
  avatarUrl?: string | null
}) {
  return (
    <div className="rounded-md border border-border/60 bg-background/72 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={displayName ?? title} className="h-full w-full object-cover" />
          ) : (
            (displayName?.slice(0, 1) ?? "·")
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{displayName ?? "暂无数据"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{countLabel}</p>
        </div>
      </div>
    </div>
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
  latestObservedAt,
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
  const topObserver = topObservers[0]
  const topIdentifier = topIdentifiers[0]

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

  const totalIdentifications = topIdentifiers.reduce((sum, row) => sum + row.identificationCount, 0)

  const monthlyChartData = monthlyAggregates.map((row) => ({
    label: MONTH_LABELS[row.month - 1],
    count: row.count,
  }))
  const yearlyChartData = yearlyAggregates.map((row) => ({
    label: String(row.year),
    count: row.count,
  }))
  const lifecycleChartData = lifecycleAggregates.map((row) => ({
    label: LIFECYCLE_LABELS[row.stage],
    count: row.count,
  }))
  const sexChartData = sexAggregates.map((row) => ({
    label: SEX_LABELS[row.sex],
    count: row.count,
  }))

  const hasMonthly = monthlyChartData.some((row) => row.count > 0)
  const hasYearly = yearlyChartData.length > 0
  const hasLifecycle = lifecycleChartData.length > 0
  const hasSex = sexChartData.length > 0
  const canRenderChart = chartWidth > 0

  return (
    <section className="surface-subtle relative isolate min-w-0 overflow-hidden rounded-lg bg-background/92 p-5 shadow-[0_20px_54px_-42px_hsl(var(--surface-shadow)/0.48)] sm:p-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold sm:text-xl">观测统计</h2>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="总观察数" value={formatCount(totalObservationCount)} />
        <Metric label="最新记录" value={formatDate(latestObservedAt)} />
        <Metric label="贡献者" value={formatCount(topObservers.length)} hint={topObservers.length > 0 ? "Top 5" : undefined} />
        <Metric
          label="鉴定记录"
          value={formatCount(totalIdentifications)}
          hint={topIdentifiers.length > 0 ? `${topIdentifiers.length} 位鉴定者` : undefined}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <UserRankCard
          icon={<Trophy className="h-3.5 w-3.5" />}
          title="最多观察记录"
          displayName={topObserver?.displayName}
          countLabel={topObserver ? `${formatCount(topObserver.observationCount)} 次观察` : "尚无观察"}
          avatarUrl={topObserver?.avatarUrl ?? null}
        />
        <UserRankCard
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
          title="最多鉴定记录"
          displayName={topIdentifier?.displayName}
          countLabel={topIdentifier ? `${formatCount(topIdentifier.identificationCount)} 次鉴定` : "尚无鉴定"}
          avatarUrl={topIdentifier?.avatarUrl ?? null}
        />
      </div>

      {topObservers.length > 1 || topIdentifiers.length > 1 ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {topObservers.length > 1 ? (
            <div className="rounded-md border border-border/50 bg-background/60 p-3">
              <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                贡献者排行
              </p>
              <ol className="mt-2 space-y-1.5 text-xs">
                {topObservers.slice(0, 5).map((person, index) => (
                  <li key={person.userId} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {index + 1}
                      </span>
                      <span className="truncate text-foreground/85">{person.displayName}</span>
                    </span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">{formatCount(person.observationCount)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          {topIdentifiers.length > 1 ? (
            <div className="rounded-md border border-border/50 bg-background/60 p-3">
              <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                鉴定者排行
              </p>
              <ol className="mt-2 space-y-1.5 text-xs">
                {topIdentifiers.slice(0, 5).map((person, index) => (
                  <li key={person.userId} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {index + 1}
                      </span>
                      <span className="truncate text-foreground/85">{person.displayName}</span>
                    </span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">{formatCount(person.identificationCount)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}

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
