"use client"

import { useMemo, useEffect, useId, useState } from "react"
import { Info } from "lucide-react"
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts"
import type { SteamRadarResult } from "@/lib/mappers/types"
import type { SteamRadarWithGuidance } from "@/lib/profile/steam-radar"
import { cn } from "@/lib/utils"

type SteamRadarChartProps = {
  userId?: string
  className?: string
  initialRadar?: SteamRadarWithGuidance | null
  showHeader?: boolean
  /** @deprecated Use userId prop instead. Kept for backward compatibility. */
  stats?: {
    scienceCompleted?: number
    techCompleted?: number
    engineeringCompleted?: number
    artCompleted?: number
    mathCompleted?: number
  } | null
}

interface RadarDimData {
  subject: string
  value: number
  tier: string
  guidance: string | null
  raw: number
  foundation: number
  intermediate: number
}

const DIM_ORDER = ['S', 'T', 'E', 'A', 'M'] as const
type DimKey = (typeof DIM_ORDER)[number]

const DIM_LABELS: Record<DimKey, string> = { S: '科学', T: '技术', E: '工程', A: '艺术', M: '数学' }
const DIM_COLORS: Record<DimKey, string> = {
  S: '#2F80ED',
  T: '#7C5CFF',
  E: '#F97316',
  A: '#EC4899',
  M: '#10B981',
}

function getDimKey(subject?: string): DimKey | null {
  return DIM_ORDER.find((dim) => DIM_LABELS[dim] === subject) ?? null
}

function getRadarLevel(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.min(5, Math.max(1, Math.ceil(value / 20)))
}

type CustomAxisTickProps = {
  payload?: { value?: string }
  x?: number | string
  y?: number | string
  textAnchor?: React.SVGProps<SVGTextElement>["textAnchor"]
  levels: Record<string, number>
}

function CustomAxisTick({ payload, x, y, textAnchor, levels }: CustomAxisTickProps) {
  const subject = payload?.value ?? ''
  const dimKey = getDimKey(subject)
  const color = dimKey ? DIM_COLORS[dimKey] : 'currentColor'
  const level = levels[subject] ?? 0
  const numericX = Number(x) || 0
  const numericY = Number(y) || 0
  const verticalOffset = dimKey === 'S' ? -8 : dimKey === 'A' || dimKey === 'E' ? 10 : 0

  return (
    <g transform={`translate(${numericX}, ${numericY + verticalOffset})`}>
      <text textAnchor={textAnchor} dominantBaseline="central">
        <tspan x={0} dy="-0.35em" fill={color} fontSize={12} fontWeight={800}>
          {subject}
        </tspan>
        <tspan x={0} dy="1.35em" fill={color} fillOpacity={0.82} fontSize={10} fontWeight={700}>
          Lv.{level}
        </tspan>
      </text>
    </g>
  )
}

type CustomRadarDotProps = {
  cx?: number
  cy?: number
  payload?: RadarDimData
}

function CustomRadarDot({ cx, cy, payload }: CustomRadarDotProps) {
  if (typeof cx !== 'number' || typeof cy !== 'number') return null

  const dimKey = getDimKey(payload?.subject)
  const color = dimKey ? DIM_COLORS[dimKey] : '#7C5CFF'

  return (
    <g>
      <circle cx={cx} cy={cy} r={4.4} fill={color} fillOpacity={0.12} />
      <circle cx={cx} cy={cy} r={2.4} fill={color} stroke="hsl(var(--background))" strokeWidth={1.25} />
    </g>
  )
}

export function SteamRadarChart({ userId, stats, className, initialRadar = null, showHeader = true }: SteamRadarChartProps) {
  const chartDomId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const glowId = `${chartDomId}-steam-radar-glow`
  const fillId = `${chartDomId}-steam-radar-fill`
  const strokeId = `${chartDomId}-steam-radar-stroke`
  const [radarData, setRadarData] = useState<SteamRadarResult | null>(null)
  const [guidance, setGuidance] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialRadar) {
      const nextGuidance: Record<string, string | null> = {}
      for (const dim of DIM_ORDER) {
        nextGuidance[dim] = initialRadar[dim]?.guidance || null
      }
      setRadarData(initialRadar as unknown as SteamRadarResult)
      setGuidance(nextGuidance)
      setLoading(false)
      setError(null)
      return
    }

    if (!userId) return
    setLoading(true)
    setError(null)
    fetch(`/api/users/${userId}/steam-radar`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          throw new Error(typeof data?.error === 'string' ? data.error : `请求失败 ${res.status}`)
        }
        return data
      })
      .then(data => {
        if (data.radar) {
          setRadarData(data.radar)
          const g: Record<string, string | null> = {}
          for (const dim of DIM_ORDER) {
            g[dim] = data.radar[dim]?.guidance || null
          }
          setGuidance(g)
        }
      })
      .catch(() => {
        setError('加载 STEAM 图谱失败，请稍后重试')
        setRadarData(null)
        setGuidance({})
      })
      .finally(() => setLoading(false))
  }, [initialRadar, userId])

  const data = useMemo((): RadarDimData[] => {
    if (radarData) {
      return DIM_ORDER.map(dim => ({
        subject: DIM_LABELS[dim],
        value: radarData[dim]?.display ?? 0,
        tier: radarData[dim]?.tier ?? 'none',
        guidance: guidance[dim] || null,
        raw: radarData[dim]?.raw ?? 0,
        foundation: 40,
        intermediate: 75,
      }))
    }

    if (stats) {
      const legacy = {
        S: stats.scienceCompleted || 0,
        T: stats.techCompleted || 0,
        E: stats.engineeringCompleted || 0,
        A: stats.artCompleted || 0,
        M: stats.mathCompleted || 0,
      }
      return DIM_ORDER.map(dim => ({
        subject: DIM_LABELS[dim],
        value: Math.min(Math.round((legacy[dim] / 50) * 100), 100),
        tier: 'none',
        guidance: null,
        raw: 0,
        foundation: 40,
        intermediate: 75,
      }))
    }

    return []
  }, [radarData, stats, guidance])

  const hasData = data.some(d => d.value > 0)
  const levelBySubject = useMemo(
    () => Object.fromEntries(data.map((item) => [item.subject, getRadarLevel(item.value)])),
    [data],
  )

  const activeGuidance = useMemo(() => {
    if (!radarData) return null
    for (const dim of DIM_ORDER) {
      const g = guidance[dim]
      if (g) return g
    }
    return null
  }, [radarData, guidance])

  if (loading) {
    return (
      <section className={cn("surface-panel p-5", className)}>
        <p className="text-sm text-muted-foreground text-center py-8">加载 STEAM 图谱...</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className={cn("surface-panel p-5", className)}>
        <p className="text-sm text-destructive text-center py-8">{error}</p>
      </section>
    )
  }

  return (
    <section className={cn("surface-panel space-y-4 overflow-hidden p-5", className)}>
      {showHeader ? (
        <div className="flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-[#2F80ED]" aria-hidden />
          <p className="text-base font-semibold tracking-tight text-foreground">STEAM 能力星图</p>
          <Info className="h-3.5 w-3.5 text-muted-foreground/70" aria-hidden />
        </div>
      ) : null}

      <div className="relative h-52 min-h-[208px] w-full min-w-[200px] sm:h-56 sm:min-h-[224px]" role="img" aria-label="STEAM 五维能力雷达图">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={196} debounce={50}>
            <RadarChart data={data} cx="50%" cy="50%" outerRadius="74%" margin={{ top: 18, right: 24, bottom: 18, left: 24 }}>
              <defs>
                <filter id={glowId} x="-35%" y="-35%" width="170%" height="170%">
                  <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#2F80ED" floodOpacity="0.18" />
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#7C5CFF" floodOpacity="0.22" />
                </filter>
                <linearGradient id={fillId} x1="8%" y1="18%" x2="92%" y2="88%">
                  <stop offset="0%" stopColor="#21C7F3" stopOpacity={0.5} />
                  <stop offset="36%" stopColor="#2F80ED" stopOpacity={0.34} />
                  <stop offset="68%" stopColor="#7C5CFF" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#EC4899" stopOpacity={0.18} />
                </linearGradient>
                <linearGradient id={strokeId} x1="10%" y1="0%" x2="90%" y2="100%">
                  <stop offset="0%" stopColor="#2F80ED" />
                  <stop offset="46%" stopColor="#22C55E" />
                  <stop offset="76%" stopColor="#7C5CFF" />
                  <stop offset="100%" stopColor="#F97316" />
                </linearGradient>
              </defs>
              <PolarGrid
                gridType="polygon"
                stroke="hsl(var(--border))"
                strokeOpacity={0.52}
                strokeWidth={1}
              />
              <PolarAngleAxis
                dataKey="subject"
                tick={(props) => <CustomAxisTick {...props} levels={levelBySubject} />}
              />
              <PolarRadiusAxis
                tick={false}
                axisLine={false}
                tickCount={6}
                domain={[0, 100]}
              />
              <Radar
                name="STEAM"
                dataKey="value"
                fill="none"
                stroke="#7C5CFF"
                strokeWidth={6}
                strokeOpacity={0.06}
                dot={false}
              />
              <Radar
                name="STEAM"
                dataKey="value"
                stroke={`url(#${strokeId})`}
                strokeWidth={2.2}
                strokeOpacity={0.95}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={`url(#${fillId})`}
                fillOpacity={1}
                dot={(props) => <CustomRadarDot {...(props as CustomRadarDotProps)} />}
                filter={`url(#${glowId})`}
              />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <p className="text-sm font-medium text-muted-foreground">
              还没有足够的数据来绘制雷达图
            </p>
            <p className="text-xs text-muted-foreground/80 mt-1.5 max-w-xs">
              参与挑战或完成项目，解锁你的 STEAM 能力图谱。
            </p>
          </div>
        )}
      </div>

      {activeGuidance && (
        <p className="surface-subtle px-3 py-3 text-xs leading-5 text-muted-foreground">
          建议：{activeGuidance}
        </p>
      )}
    </section>
  )
}
