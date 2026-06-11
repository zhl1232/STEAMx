"use client"

import { useCallback, useEffect, useRef } from "react"
import { FlipHorizontal, MousePointer2, Palette, RotateCw, Sparkles, Trophy } from "lucide-react"
import {
    PIECE_KIND,
    PIECE_SHAPES,
    TANGRAM_LEVELS,
    useTangram,
    type TangramPieceId,
    type TangramTransform,
} from "@/hooks/playground/use-tangram"
import { useGamification } from "@/lib/context/gamification-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const COLORS: Record<TangramPieceId, string> = {
    "large-a": "#ef4444",
    "large-b": "#f97316",
    medium: "#eab308",
    "small-a": "#22c55e",
    "small-b": "#06b6d4",
    square: "#8b5cf6",
    parallelogram: "#ec4899",
}

function pointsAttr(id: TangramPieceId): string {
    return PIECE_SHAPES[PIECE_KIND[id]].map(([x, y]) => `${x},${y}`).join(" ")
}

function transformAttr(transform: TangramTransform): string {
    return `translate(${transform.x} ${transform.y}) rotate(${transform.rotation}) scale(${transform.flipped ? -1 : 1} 1)`
}

function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`
}

export default function TangramPage() {
    const game = useTangram()
    const { checkBadges } = useGamification()
    const svgRef = useRef<SVGSVGElement>(null)
    const dragRef = useRef<{
        id: TangramPieceId
        offsetX: number
        offsetY: number
        startX: number
        startY: number
        moved: boolean
    } | null>(null)
    const lastTapRef = useRef<{ id: TangramPieceId; time: number } | null>(null)

    const toSvgPoint = useCallback((clientX: number, clientY: number) => {
        const svg = svgRef.current
        if (!svg) return null
        const matrix = svg.getScreenCTM()
        if (!matrix) return null
        const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse())
        return { x: point.x, y: point.y }
    }, [])

    useEffect(() => {
        if (game.status !== "solved") return
        checkBadges({
            projectsPublished: 0, projectsLiked: 0, projectsCompleted: 0,
            commentsCount: 0, scienceCompleted: 0, techCompleted: 0,
            engineeringCompleted: 0, artCompleted: 0, mathCompleted: 0,
            likesGiven: 0, likesReceived: 0, collectionsCount: 0,
            challengesJoined: 0, level: 1, loginDays: 0, consecutiveDays: 0,
            discussionsCreated: 0, repliesCount: 0,
            minesweeperWins: 0, minesweeperExpertWins: 0, minesweeperBestTime: 999,
            tangramSolved: game.stats.solvedLevels.length,
        })
    }, [checkBadges, game.stats.solvedLevels.length, game.status])

    const selectedPiece = game.pieces.find((piece) => piece.id === game.selectedId)
    const canFlip = selectedPiece ? PIECE_KIND[selectedPiece.id] === "parallelogram" : false

    return (
        <div className="playground-game-page">
            <div className="playground-game-main playground-game-center">
                <div className="w-full max-w-3xl playground-game-board">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-violet-400/40 bg-violet-500/10">
                                <Palette className="h-5 w-5 text-violet-500" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black">七巧板 · {game.level.name}</h1>
                                <p className="text-xs text-muted-foreground">把 7 块拼进灰色剪影，姿态正确时松手会自动吸附。</p>
                            </div>
                        </div>
                        <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">{formatTime(game.time)}</span>
                    </div>

                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        {TANGRAM_LEVELS.map((level, index) => (
                            <Button
                                key={level.id}
                                size="sm"
                                variant={game.levelIndex === index ? "default" : "outline"}
                                onClick={() => game.startLevel(index)}
                            >
                                {level.name}
                                {game.stats.solvedLevels.includes(level.id) && <span className="ml-1">✓</span>}
                            </Button>
                        ))}
                        <Button size="sm" variant="outline" className="ml-auto gap-1" onClick={game.rotateSelected}>
                            <RotateCw className="h-3.5 w-3.5" />
                            旋转 45°
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            disabled={!canFlip}
                            onClick={game.flipSelected}
                            title={canFlip ? "翻转平行四边形" : "只有平行四边形需要翻转"}
                        >
                            <FlipHorizontal className="h-3.5 w-3.5" />
                            翻转
                        </Button>
                    </div>

                    <div className="rounded-lg bg-muted/30 p-3">
                        <svg
                            ref={svgRef}
                            viewBox="0 0 520 660"
                            className="mx-auto h-auto w-full max-w-[640px] touch-none rounded-sm bg-background select-none"
                            onPointerMove={(event) => {
                                const drag = dragRef.current
                                if (!drag) return
                                const point = toSvgPoint(event.clientX, event.clientY)
                                if (!point) return
                                if (!drag.moved && Math.hypot(point.x - drag.startX, point.y - drag.startY) > 6) {
                                    drag.moved = true
                                }
                                game.updatePiece(drag.id, { x: point.x + drag.offsetX, y: point.y + drag.offsetY })
                            }}
                            onPointerUp={(event) => {
                                const drag = dragRef.current
                                if (!drag) return
                                dragRef.current = null
                                const svg = svgRef.current
                                if (svg?.hasPointerCapture(event.pointerId)) {
                                    svg.releasePointerCapture(event.pointerId)
                                }
                                if (drag.moved) {
                                    game.releasePiece(drag.id)
                                    return
                                }
                                // 原地松手视为点按：单击旋转 45°，快速双击翻转平行四边形
                                const now = Date.now()
                                const lastTap = lastTapRef.current
                                const isDoubleTap = lastTap !== null && lastTap.id === drag.id && now - lastTap.time < 350
                                if (isDoubleTap && PIECE_KIND[drag.id] === "parallelogram") {
                                    // 撤销首次点按已经转过的 45°，让双击的净效果只是翻转
                                    game.adjustPiece(drag.id, { rotateBy: -45, flip: true })
                                    lastTapRef.current = null
                                } else {
                                    game.adjustPiece(drag.id, { rotateBy: 45 })
                                    lastTapRef.current = { id: drag.id, time: now }
                                }
                            }}
                            onPointerCancel={() => {
                                dragRef.current = null
                            }}
                        >
                            {/* 目标剪影（参考图） */}
                            {(Object.keys(game.level.targets) as TangramPieceId[]).map((id) => (
                                <polygon
                                    key={`target-${id}`}
                                    points={pointsAttr(id)}
                                    transform={transformAttr(game.level.targets[id])}
                                    className="fill-slate-400/45 dark:fill-slate-500/35"
                                />
                            ))}

                            {/* 操作区分隔线 */}
                            <line x1="16" y1="432" x2="504" y2="432" stroke="currentColor" strokeDasharray="6 8" className="text-border" />
                            <text x="260" y="452" textAnchor="middle" fontSize="11" fill="currentColor" className="text-muted-foreground">
                                拼块区 · 拖到上方剪影
                            </text>

                            {/* 可拖拽拼块 */}
                            {game.pieces.map((piece) => (
                                <g
                                    key={piece.id}
                                    transform={transformAttr(piece)}
                                    className={cn("cursor-grab active:cursor-grabbing", game.status === "solved" && "cursor-default")}
                                    onPointerDown={(event) => {
                                        if (game.status === "solved") return
                                        event.preventDefault()
                                        const point = toSvgPoint(event.clientX, event.clientY)
                                        if (!point) return
                                        dragRef.current = {
                                            id: piece.id,
                                            offsetX: piece.x - point.x,
                                            offsetY: piece.y - point.y,
                                            startX: point.x,
                                            startY: point.y,
                                            moved: false,
                                        }
                                        try {
                                            svgRef.current?.setPointerCapture(event.pointerId)
                                        } catch {
                                            // 某些环境对合成指针事件不支持捕获，不影响拖拽
                                        }
                                        game.setSelectedId(piece.id)
                                    }}
                                >
                                    <polygon
                                        points={pointsAttr(piece.id)}
                                        fill={COLORS[piece.id]}
                                        opacity={0.92}
                                        stroke={game.selectedId === piece.id ? "white" : "rgba(255,255,255,0.35)"}
                                        strokeWidth={game.selectedId === piece.id ? 3 : 1.5}
                                        strokeLinejoin="round"
                                    />
                                </g>
                            ))}
                        </svg>
                    </div>

                    {game.status === "solved" && (
                        <div className="mt-4 rounded-lg border border-violet-400/40 bg-violet-500/10 p-4 text-center">
                            <Sparkles className="mx-auto mb-2 h-6 w-6 text-violet-500" />
                            <p className="font-black">「{game.level.name}」完成！</p>
                            <p className="text-xs text-muted-foreground">
                                用时 {formatTime(game.time)}
                                {game.levelIndex + 1 < game.levelCount && (
                                    <Button size="sm" className="ml-3" onClick={() => game.startLevel(game.levelIndex + 1)}>
                                        下一个图形
                                    </Button>
                                )}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <aside className="w-full border-t border-border bg-card/50 p-6 xl:w-96 xl:border-l xl:border-t-0">
                <div className="space-y-5">
                    <section className="rounded-sm bg-muted/30 p-4">
                        <h2 className="mb-2 flex items-center gap-2 font-bold">
                            <Trophy className="h-4 w-4 text-violet-500" />
                            图形进度
                        </h2>
                        <ul className="space-y-1.5 text-sm">
                            {TANGRAM_LEVELS.map((level) => (
                                <li key={level.id} className="flex items-center justify-between">
                                    <span>{level.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {game.stats.solvedLevels.includes(level.id)
                                            ? `最快 ${formatTime(game.stats.bestTimes[level.id] ?? 0)}`
                                            : "未完成"}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </section>
                    <section className="rounded-sm border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
                        <h3 className="mb-2 font-bold text-foreground">这关的提示</h3>
                        <p className="leading-relaxed">{game.level.hint}</p>
                    </section>
                    <section className="rounded-sm border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
                        <h3 className="mb-2 font-bold text-foreground">空间想象力</h3>
                        <p className="leading-relaxed">
                            七巧板的 7 块面积比是 4:4:2:1:1:2:2。两块大三角可以互换位置，正方形转 90° 等价，
                            平行四边形是唯一需要「翻转」才能改变手性的块。
                        </p>
                    </section>
                    <section className="flex items-center gap-2 rounded-sm bg-muted/20 p-4 text-xs text-muted-foreground">
                        <MousePointer2 className="h-4 w-4" />
                        <span>拖动移动 · 单击旋转 45° · 双击翻转平行四边形 · 姿态正确时靠近目标自动吸附。</span>
                    </section>
                </div>
            </aside>
        </div>
    )
}
