"use client"

import { useMemo, useEffect, useId, useState } from "react"
import { useTheme } from "next-themes"
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
  embedded?: boolean
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

const DIM_COLORS_LIGHT: Record<DimKey, string> = {
  S: '#1D4ED8', // 科学: 纯正蓝
  T: '#6D28D9', // 技术: 纯正紫
  E: '#C2410C', // 工程: 鲜明橙
  A: '#BE185D', // 艺术: 玫红
  M: '#047857', // 数学: 翡翠绿
}

const DIM_COLORS_DARK: Record<DimKey, string> = {
  S: '#60A5FA', // 科学: 荧光亮天蓝 (亮度 ~70%, 告别深黑发暗)
  T: '#C084FC', // 技术: 荧光浅紫罗兰 (亮度 ~75%, 极为明亮)
  E: '#FB923C', // 工程: 鲜明亮橙 (亮度 ~65%)
  A: '#F472B6', // 艺术: 柔亮洋红粉 (亮度 ~70%)
  M: '#34D399', // 数学: 清透荧光绿 (亮度 ~65%)
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
  isDark?: boolean
}

function CustomAxisTick({ payload, x, y, textAnchor, levels, isDark = false }: CustomAxisTickProps) {
  const subject = payload?.value ?? ''
  const dimKey = getDimKey(subject)
  const colors = isDark ? DIM_COLORS_DARK : DIM_COLORS_LIGHT
  const color = dimKey ? colors[dimKey] : (isDark ? '#E2E8F0' : '#1E293B')
  const level = levels[subject] ?? 0
  const numericX = Number(x) || 0
  const numericY = Number(y) || 0
  const verticalOffset = dimKey === 'S' ? -8 : dimKey === 'A' || dimKey === 'E' ? 10 : 0
  const levelColor = level > 0 ? color : (isDark ? '#94A3B8' : '#64748B')

  return (
    <g transform={`translate(${numericX}, ${numericY + verticalOffset})`}>
      <text textAnchor={textAnchor} dominantBaseline="central">
        <tspan x={0} dy="-0.35em" fill={color} fontSize={12.5} fontWeight={800}>
          {subject}
        </tspan>
        <tspan x={0} dy="1.35em" fill={levelColor} fontSize={10.5} fontWeight={700}>
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
  isDark?: boolean
}

function CustomRadarDot({ cx, cy, payload, isDark = false }: CustomRadarDotProps) {
  if (typeof cx !== 'number' || typeof cy !== 'number') return null

  const dimKey = getDimKey(payload?.subject)
  const colors = isDark ? DIM_COLORS_DARK : DIM_COLORS_LIGHT
  const color = dimKey ? colors[dimKey] : (isDark ? '#C084FC' : '#7C5CFF')

  return (
    <g>
      <circle cx={cx} cy={cy} r={isDark ? 5.5 : 4.4} fill={color} fillOpacity={isDark ? 0.28 : 0.15} />
      <circle cx={cx} cy={cy} r={2.8} fill={color} stroke={isDark ? '#0F172A' : '#FFFFFF'} strokeWidth={1.5} />
    </g>
  )
}

export function SteamRadarChart({
  userId,
  stats,
  className,
  initialRadar = null,
  showHeader = true,
  embedded = false,
}: SteamRadarChartProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const isDark = mounted ? resolvedTheme === 'dark' : false

  useEffect(() => {
    setMounted(true)
  }, [])

  const chartDomId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const glowId = `${chartDomId}-steam-radar-glow`
  const fillId = `${chartDomId}-steam-radar-fill`
  const strokeId = `${chartDomId}-steam-radar-stroke`
  const [radarData, setRadarData] = useState<SteamRadarResult | null>(null)
  const [guidance, setGuidance] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEmbedded = embedded || Boolean(className?.includes('border-0'))

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

  if (loading) {
    if (isEmbedded) {
      return (
        <div className={cn("p-4 text-center", className)}>
          <p className="text-sm text-muted-foreground py-8">加载 STEAM 图谱...</p>
        </div>
      )
    }
    return (
      <section className={cn("surface-panel p-5", className)}>
        <p className="text-sm text-muted-foreground text-center py-8">加载 STEAM 图谱...</p>
      </section>
    )
  }

  if (error) {
    if (isEmbedded) {
      return (
        <div className={cn("p-4 text-center", className)}>
          <p className="text-sm text-destructive py-8">{error}</p>
        </div>
      )
    }
    return (
      <section className={cn("surface-panel p-5", className)}>
        <p className="text-sm text-destructive text-center py-8">{error}</p>
      </section>
    )
  }

  const Container = isEmbedded ? 'div' : 'section'

  return (
    <Container className={cn(!isEmbedded && "surface-panel p-5", "space-y-4 overflow-hidden", className)}>
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
                  <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor={isDark ? '#60A5FA' : '#2F80ED'} floodOpacity={isDark ? 0.3 : 0.18} />
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={isDark ? '#C084FC' : '#7C5CFF'} floodOpacity={isDark ? 0.35 : 0.22} />
                </filter>
                <linearGradient id={fillId} x1="8%" y1="18%" x2="92%" y2="88%">
                  <stop offset="0%" stopColor={isDark ? '#38BDF8' : '#21C7F3'} stopOpacity={isDark ? 0.55 : 0.5} />
                  <stop offset="36%" stopColor={isDark ? '#60A5FA' : '#2F80ED'} stopOpacity={isDark ? 0.42 : 0.34} />
                  <stop offset="68%" stopColor={isDark ? '#C084FC' : '#7C5CFF'} stopOpacity={isDark ? 0.45 : 0.4} />
                  <stop offset="100%" stopColor={isDark ? '#F472B6' : '#EC4899'} stopOpacity={isDark ? 0.28 : 0.18} />
                </linearGradient>
                <linearGradient id={strokeId} x1="10%" y1="0%" x2="90%" y2="100%">
                  <stop offset="0%" stopColor={isDark ? '#38BDF8' : '#2F80ED'} />
                  <stop offset="36%" stopColor={isDark ? '#34D399' : '#22C55E'} />
                  <stop offset="68%" stopColor={isDark ? '#C084FC' : '#7C5CFF'} />
                  <stop offset="100%" stopColor={isDark ? '#FB923C' : '#F97316'} />
                </linearGradient>
              </defs>
              <PolarGrid
                gridType="polygon"
                stroke={isDark ? '#475569' : 'hsl(var(--border))'}
                strokeOpacity={isDark ? 0.85 : 0.55}
                strokeWidth={isDark ? 1.2 : 1}
              />
              <PolarAngleAxis
                dataKey="subject"
                tick={(props) => <CustomAxisTick {...props} levels={levelBySubject} isDark={isDark} />}
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
                stroke={isDark ? '#C084FC' : '#7C5CFF'}
                strokeWidth={6}
                strokeOpacity={isDark ? 0.12 : 0.06}
                dot={false}
              />
              <Radar
                name="STEAM"
                dataKey="value"
                stroke={`url(#${strokeId})`}
                strokeWidth={2.4}
                strokeOpacity={1}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={`url(#${fillId})`}
                fillOpacity={1}
                dot={(props) => <CustomRadarDot {...(props as CustomRadarDotProps)} isDark={isDark} />}
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
    </Container>
  )
}
