import { useMemo } from "react"
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
} from "recharts"
import type { UserStats } from "@/lib/gamification/types"
import { Card } from "@/components/ui/card"

type SteamRadarChartProps = {
    stats: Pick<
        UserStats,
        "scienceCompleted" | "techCompleted" | "engineeringCompleted" | "artCompleted" | "mathCompleted"
    > | null
}

const MAX_VALUE = 50

export function SteamRadarChart({ stats }: SteamRadarChartProps) {
    const hasData =
        !!stats &&
        (stats.scienceCompleted ||
            stats.techCompleted ||
            stats.engineeringCompleted ||
            stats.artCompleted ||
            stats.mathCompleted)

    const data = useMemo(() => {
        if (!stats) return []
        const normalize = (value: number) =>
            Math.min(Math.round((value / MAX_VALUE) * 100), 100)

        return [
            { subject: "S 科学", value: normalize(stats.scienceCompleted || 0) },
            { subject: "T 技术", value: normalize(stats.techCompleted || 0) },
            { subject: "E 工程", value: normalize(stats.engineeringCompleted || 0) },
            { subject: "A 艺术", value: normalize(stats.artCompleted || 0) },
            { subject: "M 数学", value: normalize(stats.mathCompleted || 0) },
        ]
    }, [stats])

    return (
        <Card className="bg-card rounded-2xl border shadow-sm p-4 sm:p-5 space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-muted-foreground">STEAM 能力图谱</p>
                    <p className="text-xs text-muted-foreground/80 mt-0.5 hidden sm:block">
                        根据你完成的不同类别项目，粗略描绘你的兴趣与优势。
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
                                tickCount={4}
                                domain={[0, 100]}
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
                            多尝试完成几类不同的项目（科学 / 技术 / 工程 / 艺术 / 数学），你的 STEAM 能力图谱就会在这里逐渐亮起来。
                        </p>
                    </div>
                )}
            </div>
        </Card>
    )
}

