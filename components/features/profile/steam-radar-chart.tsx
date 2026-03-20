"use client"

import { useMemo, useEffect, useState } from "react"
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts"
import { Card } from "@/components/ui/card"
import type { SteamRadarResult } from "@/lib/mappers/types"

type SteamRadarChartProps = {
  userId?: string
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
const DIM_LABELS: Record<string, string> = { S: 'S 科学', T: 'T 技术', E: 'E 工程', A: 'A 艺术', M: 'M 数学' }
const DIM_NAMES: Record<string, string> = { S: '科学', T: '技术', E: '工程', A: '艺术', M: '数学' }
const TIER_LABELS: Record<string, string> = { none: '', foundation: '基础', intermediate: '进阶', advanced: '挑战' }

const DIM_COLORS: Record<string, string> = {
  S: '#6366f1',
  T: '#06b6d4',
  E: '#f59e0b',
  A: '#ec4899',
  M: '#10b981',
}

type CustomAxisTickProps = {
  payload?: { value?: string }
  x?: number | string
  y?: number | string
  textAnchor?: React.SVGProps<SVGTextElement>["textAnchor"]
}

function CustomAxisTick({ payload, x, y, textAnchor }: CustomAxisTickProps) {
  const value = payload?.value ?? ''
  const dimKey = Object.entries(DIM_LABELS).find(([, v]) => v === value)?.[0] || ''
  const color = DIM_COLORS[dimKey] || 'currentColor'
  const parts = value.split(' ')
  return (
    <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" fontSize={11}>
      <tspan fill={color} fontWeight={700}>{parts[0]}</tspan>
      <tspan fill={color} fillOpacity={0.6} fontWeight={400}>{' '}{parts[1]}</tspan>
    </text>
  )
}

export function SteamRadarChart({ userId, stats }: SteamRadarChartProps) {
  const [radarData, setRadarData] = useState<SteamRadarResult | null>(null)
  const [guidance, setGuidance] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    fetch(`/api/users/${userId}/steam-radar`)
      .then(res => res.json())
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
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

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
      <Card className="bg-card rounded-2xl border shadow-sm p-4 sm:p-5">
        <p className="text-sm text-muted-foreground text-center py-8">加载 STEAM 图谱...</p>
      </Card>
    )
  }

  return (
    <Card className="bg-card rounded-2xl border shadow-sm p-4 sm:p-5 space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">STEAM 能力图谱</p>
        <p className="text-xs text-muted-foreground/70 mt-0.5 hidden sm:block">
          综合项目完成和挑战参与，含难度系数与递减收益算法。
        </p>
      </div>

      <div className="h-52 sm:h-64 min-h-[208px] sm:min-h-[256px] w-full min-w-[200px]">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={208} debounce={50}>
            <RadarChart data={data} outerRadius="78%">
              <defs>
                <radialGradient id="steamRadarFill" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                  <stop offset="60%" stopColor="#6366f1" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.06} />
                </radialGradient>
              </defs>
              <PolarGrid
                gridType="polygon"
                stroke="hsl(var(--border))"
                strokeOpacity={0.35}
              />
              <PolarAngleAxis
                dataKey="subject"
                tick={<CustomAxisTick />}
              />
              <PolarRadiusAxis
                tick={false}
                axisLine={false}
                tickCount={5}
                domain={[0, 100]}
              />
              <Radar
                name="基础线"
                dataKey="foundation"
                stroke="hsl(var(--muted-foreground))"
                strokeOpacity={0.18}
                strokeDasharray="3 3"
                fill="none"
              />
              <Radar
                name="进阶线"
                dataKey="intermediate"
                stroke="hsl(var(--muted-foreground))"
                strokeOpacity={0.12}
                strokeDasharray="3 3"
                fill="none"
              />
              <Radar
                name="STEAM"
                dataKey="value"
                stroke="#7c3aed"
                strokeWidth={1.5}
                strokeOpacity={0.8}
                fill="url(#steamRadarFill)"
                fillOpacity={1}
                dot={false}
              />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <p className="text-sm font-medium text-muted-foreground">
              还没有足够的数据来绘制雷达图
            </p>
            <p className="text-xs text-muted-foreground/80 mt-1.5 max-w-xs">
              参与挑战赛或完成项目，解锁你的 STEAM 能力图谱。
            </p>
          </div>
        )}
      </div>

      {hasData && radarData && (
        <div className="grid grid-cols-5 gap-1">
          {DIM_ORDER.map(dim => {
            const d = radarData[dim]
            const color = DIM_COLORS[dim]
            const display = d?.display ?? 0
            const tier = d?.tier ?? 'none'
            return (
              <div key={dim} className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl bg-muted/30">
                <div className="w-[70%] h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ backgroundColor: color, width: `${Math.min(display, 100)}%` }}
                  />
                </div>
                <span className="text-base font-bold tabular-nums leading-none" style={{ color }}>
                  {display < 1 ? '—' : Math.round(display)}
                </span>
                <span className="text-[10px] font-medium text-muted-foreground leading-none">
                  {DIM_NAMES[dim]}
                </span>
                {tier !== 'none' && (
                  <span
                    className="text-[9px] font-medium leading-none px-1.5 py-0.5 rounded-full"
                    style={{ color, backgroundColor: `${color}14` }}
                  >
                    {TIER_LABELS[tier]}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {activeGuidance && (
        <p className="text-xs text-center text-muted-foreground/80 bg-muted/30 rounded-xl px-3 py-2.5">
          💡 {activeGuidance}
        </p>
      )}
    </Card>
  )
}
