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
const TIER_LABELS: Record<string, string> = { none: '', foundation: '基础', intermediate: '进阶', advanced: '挑战' }
const TIER_COLORS: Record<string, string> = { none: 'text-muted-foreground', foundation: 'text-blue-500', intermediate: 'text-green-500', advanced: 'text-purple-500' }

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

    // Fallback to legacy stats
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

  // Find the most actionable guidance message
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
    <Card className="bg-card rounded-2xl border shadow-sm p-4 sm:p-5 space-y-2 sm:space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">STEAM 能力图谱</p>
          <p className="text-xs text-muted-foreground/80 mt-0.5 hidden sm:block">
            综合项目完成和挑战参与，含难度系数与递减收益算法。
          </p>
        </div>
      </div>
      <div className="h-52 sm:h-64 w-full">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="80%">
              <PolarGrid
                gridType="polygon"
                stroke="hsl(var(--border))"
                strokeOpacity={0.5}
              />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              />
              <PolarRadiusAxis
                tick={false}
                axisLine={false}
                tickCount={5}
                domain={[0, 100]}
              />
              {/* Reference lines for tier thresholds */}
              <Radar
                name="基础线"
                dataKey="foundation"
                stroke="hsl(var(--muted-foreground))"
                strokeOpacity={0.3}
                strokeDasharray="4 4"
                fill="none"
              />
              <Radar
                name="进阶线"
                dataKey="intermediate"
                stroke="hsl(var(--muted-foreground))"
                strokeOpacity={0.2}
                strokeDasharray="4 4"
                fill="none"
              />
              <Radar
                name="STEAM"
                dataKey="value"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.25}
                dot={{ r: 3, fill: "hsl(var(--primary))" }}
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

      {/* Tier labels */}
      {hasData && radarData && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center">
          {DIM_ORDER.map(dim => {
            const d = radarData[dim]
            if (!d || d.display < 1) return null
            return (
              <span key={dim} className={`text-xs font-medium ${TIER_COLORS[d.tier]}`}>
                {DIM_LABELS[dim].split(' ')[1]} {Math.round(d.display)} {TIER_LABELS[d.tier] && `· ${TIER_LABELS[d.tier]}`}
              </span>
            )
          })}
        </div>
      )}

      {/* Guidance message */}
      {activeGuidance && (
        <p className="text-xs text-center text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          💡 {activeGuidance}
        </p>
      )}
    </Card>
  )
}
