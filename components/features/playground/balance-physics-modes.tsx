"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowRight, ChevronLeft, ChevronRight, FlaskConical, RotateCcw, Sparkles, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { usePlaygroundStatsLoader } from "@/lib/playground/use-playground-stats-loader"
import {
    DENSITY_MATERIALS,
    DENSITY_PUZZLES,
    LEVER_PEGS,
    LEVER_PUZZLES,
    blockDensity,
    blockMass,
    densestBlock,
    describeLever,
    isSortedByDensity,
    leverCount,
    leverTilt,
    leverTorque,
    loadPhysicsProgress,
    savePhysicsProgress,
    weighBlocks,
    type DensityBlock,
    type PhysicsProgressField,
} from "@/lib/playground/balance-physics"

function useProgress(field: PhysicsProgressField) {
    const [solved, setSolved] = useState<string[]>([])
    usePlaygroundStatsLoader(() => setSolved(loadPhysicsProgress(field)))
    const markSolved = (id: string) => {
        setSolved((prev) => {
            if (prev.includes(id)) return prev
            const next = [...prev, id]
            savePhysicsProgress(field, next)
            return next
        })
    }
    return { solved, markSolved }
}

/** 紧凑关卡步进：第 n 关 / N，无横向裁切 */
function LevelStepper({
    index,
    total,
    name,
    onPrev,
    onNext,
    canPrev,
    canNext,
}: {
    index: number
    total: number
    name: string
    onPrev: () => void
    onNext: () => void
    canPrev: boolean
    canNext: boolean
}) {
    return (
        <div className="mb-4 flex items-center gap-2" role="group" aria-label="关卡">
            <button
                type="button"
                onClick={onPrev}
                disabled={!canPrev}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted/70 text-foreground transition-colors hover:bg-muted disabled:opacity-40"
                aria-label="上一关"
            >
                <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1 text-center">
                <p className="text-[15px] font-black text-foreground">
                    第 {index + 1} 关<span className="mx-1 font-semibold text-muted-foreground">/</span>
                    {total}
                </p>
                <p className="truncate text-[15px] font-semibold text-muted-foreground">{name}</p>
            </div>
            <button
                type="button"
                onClick={onNext}
                disabled={!canNext}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted/70 text-foreground transition-colors hover:bg-muted disabled:opacity-40"
                aria-label="下一关"
            >
                <ChevronRight className="h-5 w-5" />
            </button>
        </div>
    )
}

function LabLink({ experiment, label }: { experiment: string; label: string }) {
    return (
        <Link
            href={`/playground/physics-lab?experiment=${experiment}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary/10 px-4 text-[15px] font-bold text-primary hover:bg-primary/15"
        >
            <FlaskConical className="h-4 w-4" />
            {label}
            <ArrowRight className="h-4 w-4" />
        </Link>
    )
}

function FeedbackLine({ children, good }: { children: React.ReactNode; good?: boolean }) {
    return (
        <p
            role="status"
            aria-live="polite"
            className={cn(
                "mb-3 text-center text-[15px] font-semibold leading-relaxed",
                good ? "text-primary" : "text-foreground",
            )}
        >
            {children}
        </p>
    )
}

/* ====================== 杠杆平衡 · SVG 跷跷板 ====================== */

const SVG_W = 400
const SVG_H = 210
const BEAM_Y = 78
const FULCRUM_X = 200
const PEG_GAP = 38

function pegX(side: -1 | 1, d: number) {
    return FULCRUM_X + side * d * PEG_GAP
}

function WeightDisc({ x, y, tone }: { x: number; y: number; tone: "left" | "right" }) {
    const fill = tone === "left" ? "url(#wLeft)" : "url(#wRight)"
    return (
        <g transform={`translate(${x}, ${y})`}>
            <ellipse cx={0} cy={3} rx={14} ry={5} fill="oklch(0.2 0.02 250 / 0.18)" />
            <ellipse cx={0} cy={0} rx={14} ry={6.5} fill={fill} stroke="oklch(0.35 0.04 250 / 0.35)" strokeWidth={1} />
            <ellipse cx={0} cy={-2.2} rx={10} ry={3} fill="oklch(1 0 0 / 0.28)" />
        </g>
    )
}

function LeverSeesaw({
    left,
    right,
    tilt,
    interactive,
    onAdd,
    onRemove,
}: {
    left: Record<number, number>
    right: Record<number, number>
    tilt: number
    interactive: boolean
    onAdd: (d: number) => void
    onRemove: (d: number) => void
}) {
    const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const didLongRef = useRef(false)

    const clearLong = () => {
        if (longPressRef.current) {
            clearTimeout(longPressRef.current)
            longPressRef.current = null
        }
    }

    const handlePegPointerDown = (d: number, count: number) => {
        if (!interactive) return
        didLongRef.current = false
        clearLong()
        longPressRef.current = setTimeout(() => {
            didLongRef.current = true
            if (count > 0) onRemove(d)
            longPressRef.current = null
        }, 450)
    }

    const handlePegClick = (d: number) => {
        if (!interactive) return
        if (didLongRef.current) {
            didLongRef.current = false
            return
        }
        onAdd(d)
    }

    const renderStack = (side: -1 | 1, d: number, count: number, tone: "left" | "right") => {
        const x = pegX(side, d)
        const discs = Array.from({ length: count }, (_, i) => (
            <WeightDisc key={i} x={x} y={BEAM_Y + 18 + i * 11} tone={tone} />
        ))
        return (
            <g key={`${side}-${d}`}>
                {/* 挂钩 */}
                <line x1={x} y1={BEAM_Y + 4} x2={x} y2={BEAM_Y + 14} stroke="oklch(0.45 0.02 250)" strokeWidth={2} strokeLinecap="round" />
                <path d={`M ${x - 5} ${BEAM_Y + 14} Q ${x} ${BEAM_Y + 20} ${x + 5} ${BEAM_Y + 14}`} fill="none" stroke="oklch(0.45 0.02 250)" strokeWidth={2} strokeLinecap="round" />
                {discs}
                {/* 可点区域（仅右侧） */}
                {side === 1 ? (
                    <rect
                        x={x - 20}
                        y={BEAM_Y - 8}
                        width={40}
                        height={Math.max(56, 22 + count * 11)}
                        fill="transparent"
                        className={interactive ? "cursor-pointer" : undefined}
                        onClick={() => handlePegClick(d)}
                        onPointerDown={() => handlePegPointerDown(d, count)}
                        onPointerUp={clearLong}
                        onPointerLeave={clearLong}
                        onContextMenu={(e) => {
                            e.preventDefault()
                            if (interactive && count > 0) onRemove(d)
                        }}
                        aria-label={`右 ${d} 格，${count} 个砝码。点一下加减，长按拿走`}
                        role="button"
                    />
                ) : null}
            </g>
        )
    }

    return (
        <div className="mx-auto mb-3 w-full max-w-xl select-none" data-testid="lever-beam">
            <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="h-auto w-full" role="img" aria-label="杠杆跷跷板">
                <defs>
                    <linearGradient id="plank" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.82 0.04 75)" />
                        <stop offset="55%" stopColor="oklch(0.7 0.06 65)" />
                        <stop offset="100%" stopColor="oklch(0.58 0.05 55)" />
                    </linearGradient>
                    <linearGradient id="plankDark" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.48 0.04 70)" />
                        <stop offset="100%" stopColor="oklch(0.32 0.03 55)" />
                    </linearGradient>
                    <linearGradient id="wLeft" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.72 0.12 250)" />
                        <stop offset="100%" stopColor="oklch(0.48 0.14 250)" />
                    </linearGradient>
                    <linearGradient id="wRight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.78 0.1 250)" />
                        <stop offset="100%" stopColor="oklch(0.52 0.13 250)" />
                    </linearGradient>
                    <linearGradient id="fulcrum" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.55 0.03 250)" />
                        <stop offset="100%" stopColor="oklch(0.32 0.02 250)" />
                    </linearGradient>
                </defs>

                {/* 底座阴影 */}
                <ellipse cx={FULCRUM_X} cy={188} rx={54} ry={8} fill="oklch(0.3 0.02 250 / 0.12)" />

                {/* 支点三角 */}
                <polygon points={`${FULCRUM_X},92 ${FULCRUM_X - 28},168 ${FULCRUM_X + 28},168`} fill="url(#fulcrum)" />
                <rect x={FULCRUM_X - 36} y={166} width={72} height={10} rx={3} fill="oklch(0.4 0.02 250)" />

                {/* 倾斜的梁 + 砝码 */}
                <g
                    style={{
                        transformOrigin: `${FULCRUM_X}px ${BEAM_Y}px`,
                        transform: `rotate(${tilt}deg)`,
                        transition: "transform 520ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                >
                    {/* 木板 */}
                    <rect x={28} y={BEAM_Y - 7} width={344} height={14} rx={4} className="fill-[url(#plank)] dark:fill-[url(#plankDark)]" fill="url(#plank)" />
                    <rect x={28} y={BEAM_Y - 7} width={344} height={3} rx={2} fill="oklch(1 0 0 / 0.22)" />

                    {/* 刻度线 */}
                    {([-4, -3, -2, -1, 0, 1, 2, 3, 4] as const).map((d) => {
                        const x = FULCRUM_X + d * PEG_GAP
                        return (
                            <g key={d}>
                                <line x1={x} y1={BEAM_Y - 7} x2={x} y2={BEAM_Y + 7} stroke="oklch(0.3 0.02 60 / 0.45)" strokeWidth={d === 0 ? 2.5 : 1.5} />
                                {d !== 0 ? (
                                    <text x={x} y={BEAM_Y - 14} textAnchor="middle" className="fill-foreground" style={{ fontSize: 11, fontWeight: 700, opacity: 0.7 }}>
                                        {Math.abs(d)}
                                    </text>
                                ) : null}
                            </g>
                        )
                    })}

                    {/* 左侧固定砝码 */}
                    {LEVER_PEGS.map((d) => renderStack(-1, d, left[d] ?? 0, "left"))}
                    {/* 右侧可交互 */}
                    {LEVER_PEGS.map((d) => renderStack(1, d, right[d] ?? 0, "right"))}
                </g>
            </svg>
            <p className="mt-1 text-center text-sm font-semibold text-muted-foreground">
                点右边挂钩挂砝码 · 长按拿走 · 或用下方撤销
            </p>
        </div>
    )
}

export function LeverMode() {
    const { solved, markSolved } = useProgress("leverSolved")
    const [index, setIndex] = useState(0)
    const [right, setRight] = useState<Record<number, number>>({})
    const [history, setHistory] = useState<Record<number, number>[]>([])
    const puzzle = LEVER_PUZZLES[index]
    const leftT = leverTorque(puzzle.left)
    const rightT = leverTorque(right)
    const used = leverCount(right)
    const tilt = leverTilt(leftT, rightT)
    const balanced = used > 0 && leftT === rightT
    const isSolved = balanced && used <= puzzle.maxWeights

    useEffect(() => {
        if (isSolved) markSolved(puzzle.id)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSolved, puzzle.id])

    const unlockedMax = (() => {
        let max = 0
        for (let i = 0; i < LEVER_PUZZLES.length; i += 1) {
            if (i === 0 || solved.includes(LEVER_PUZZLES[i - 1].id) || solved.includes(LEVER_PUZZLES[i].id)) max = i
            else break
        }
        return max
    })()

    const pick = (i: number) => {
        setIndex(i)
        setRight({})
        setHistory([])
    }

    const pushRight = (next: Record<number, number>) => {
        setHistory((h) => [...h, right])
        setRight(next)
    }

    const add = (d: number) => {
        if (isSolved || used >= puzzle.maxWeights) return
        pushRight({ ...right, [d]: (right[d] ?? 0) + 1 })
    }
    const remove = (d: number) => {
        if (isSolved || !(right[d] > 0)) return
        pushRight({ ...right, [d]: Math.max(0, (right[d] ?? 0) - 1) })
    }
    const undo = () => {
        setHistory((h) => {
            if (!h.length) return h
            const prev = h[h.length - 1]
            setRight(prev)
            return h.slice(0, -1)
        })
    }

    const verdict = used === 0
        ? "在右边的挂钩上点一下，挂上砝码。"
        : leftT === rightT
          ? `左 ${describeLever(puzzle.left)} = ${leftT}，右 ${describeLever(right)} = ${rightT} → 平衡！`
          : leftT > rightT
            ? `左 ${describeLever(puzzle.left)} = ${leftT}，右 ${describeLever(right)} = ${rightT} → 向左倾`
            : `左 ${describeLever(puzzle.left)} = ${leftT}，右 ${describeLever(right)} = ${rightT} → 向右倾`

    return (
        <div className="pb-8">
            <LevelStepper
                index={index}
                total={LEVER_PUZZLES.length}
                name={puzzle.name}
                onPrev={() => pick(Math.max(0, index - 1))}
                onNext={() => pick(Math.min(unlockedMax, index + 1))}
                canPrev={index > 0}
                canNext={index < unlockedMax}
            />
            <p className="mb-2 text-center text-[15px] leading-relaxed text-foreground">
                {puzzle.tip}
                <span className="ml-1 font-bold text-muted-foreground">砝码 {used}/{puzzle.maxWeights}</span>
            </p>

            <LeverSeesaw
                left={puzzle.left}
                right={right}
                tilt={tilt}
                interactive={!isSolved}
                onAdd={add}
                onRemove={remove}
            />

            <FeedbackLine good={isSolved}>{verdict}</FeedbackLine>

            <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
                <Button variant="outline" className="min-h-11 rounded-full" onClick={undo} disabled={!history.length || isSolved}>
                    <Undo2 className="mr-1.5 h-4 w-4" />撤销
                </Button>
                <Button variant="outline" className="min-h-11 rounded-full" onClick={() => { setRight({}); setHistory([]) }} disabled={used === 0 && !isSolved}>
                    <RotateCcw className="mr-1.5 h-4 w-4" />清空
                </Button>
                {isSolved && index < LEVER_PUZZLES.length - 1 ? (
                    <Button className="min-h-11 rounded-full" onClick={() => pick(index + 1)}>
                        下一关：{LEVER_PUZZLES[index + 1].name}
                    </Button>
                ) : null}
            </div>

            {isSolved ? (
                <p className="mb-4 text-center text-[15px] leading-relaxed text-foreground">
                    <Sparkles className="mr-1 inline h-4 w-4 text-primary" />
                    杠杆平衡：<b>F₁ × L₁ = F₂ × L₂</b>。力臂越长，需要的力越小。
                </p>
            ) : null}

            <div className="flex justify-center">
                <LabLink experiment="lever" label="去物理实验室：让杠杆平衡" />
            </div>
        </div>
    )
}

/* ====================== 密度比较 ====================== */

function BlockView({ block, size }: { block: DensityBlock; size: "sm" | "md" }) {
    const m = DENSITY_MATERIALS[block.material]
    const edge = Math.max(28, Math.min(58, Math.cbrt(block.volume) * 18))
    const px = size === "sm" ? edge * 0.8 : edge
    return (
        <span
            className={cn("inline-grid place-items-center rounded-md text-base shadow-sm", m.color)}
            style={{ width: px, height: px }}
            aria-hidden
        >
            {m.emoji}
        </span>
    )
}

export function DensityMode() {
    const { solved, markSolved } = useProgress("densitySolved")
    const [index, setIndex] = useState(0)
    const puzzle = DENSITY_PUZZLES[index]
    const [pans, setPans] = useState<{ left: DensityBlock | null; right: DensityBlock | null }>({ left: null, right: null })
    const [log, setLog] = useState<string[]>([])
    const [answer, setAnswer] = useState<DensityBlock[]>([])
    const [verdict, setVerdict] = useState<"none" | "right" | "wrong">("none")
    const isSolved = verdict === "right"

    const result = pans.left && pans.right ? weighBlocks(pans.left, pans.right) : null
    const tilt = result === "left" ? -10 : result === "right" ? 10 : 0

    const unlockedMax = (() => {
        let max = 0
        for (let i = 0; i < DENSITY_PUZZLES.length; i += 1) {
            if (i === 0 || solved.includes(DENSITY_PUZZLES[i - 1].id) || solved.includes(DENSITY_PUZZLES[i].id)) max = i
            else break
        }
        return max
    })()

    const reset = (i = index) => {
        setIndex(i); setPans({ left: null, right: null }); setLog([]); setAnswer([]); setVerdict("none")
    }

    const placeOnPan = (b: DensityBlock) => {
        if (isSolved) return
        setPans((p) => {
            if (p.left?.id === b.id) return { ...p, left: null }
            if (p.right?.id === b.id) return { ...p, right: null }
            const next = !p.left ? { ...p, left: b } : !p.right ? { ...p, right: b } : { left: p.right, right: b }
            if (next.left && next.right) {
                const r = weighBlocks(next.left, next.right)
                const L = DENSITY_MATERIALS[next.left.material].name, R = DENSITY_MATERIALS[next.right.material].name
                const line = r === "equal" ? `${L} 和 ${R} 一样重` : r === "left" ? `${L} 比 ${R} 重` : `${R} 比 ${L} 重`
                setLog((l) => [line, ...l.filter((x) => x !== line)].slice(0, 3))
            }
            return next
        })
    }

    const tapAnswer = (b: DensityBlock) => {
        if (isSolved) return
        setVerdict("none")
        if (puzzle.goal === "pick-densest") {
            setAnswer([b])
            const ok = densestBlock(puzzle.blocks).id === b.id
            setVerdict(ok ? "right" : "wrong")
            if (ok) markSolved(puzzle.id)
            return
        }
        setAnswer((a) => {
            if (a.some((x) => x.id === b.id)) return a.filter((x) => x.id !== b.id)
            const next = [...a, b]
            if (next.length === puzzle.blocks.length) {
                const ok = isSortedByDensity(next)
                setVerdict(ok ? "right" : "wrong")
                if (ok) markSolved(puzzle.id)
            }
            return next
        })
    }

    const kindLabel = puzzle.kind === "same-volume" ? "体积相同" : "质量相同"
    const goalLabel = puzzle.goal === "pick-densest" ? "点选密度最大的" : `按密度从小到大点选（${answer.length}/${puzzle.blocks.length}）`

    const panContent = (b: DensityBlock | null, label: string) => (
        <div className="flex h-16 w-20 flex-col items-center justify-end rounded-b-full border-b-[3px] border-foreground/40 pb-1 sm:w-24">
            {b ? <BlockView block={b} size="sm" /> : <span className="text-sm font-bold text-muted-foreground">{label}</span>}
        </div>
    )

    const feedback = useMemo(() => {
        if (verdict === "right") return null
        if (verdict === "wrong") return puzzle.goal === "pick-densest" ? "不对，再称一称：体积相同看谁更重，质量相同看谁更小。" : "顺序不对，点已选的可撤回。"
        if (result === "equal") return puzzle.kind === "same-mass" ? "平衡：质量相同。体积越小，密度越大。" : "天平平衡。"
        if (result) return `${puzzle.kind === "same-volume" ? "体积相同，" : ""}下沉的一边更重${puzzle.kind === "same-volume" ? "，密度更大" : ""}。`
        return "点方块放到天平上，先左后右。"
    }, [puzzle, result, verdict])

    return (
        <div className="pb-8">
            <LevelStepper
                index={index}
                total={DENSITY_PUZZLES.length}
                name={puzzle.name}
                onPrev={() => reset(Math.max(0, index - 1))}
                onNext={() => reset(Math.min(unlockedMax, index + 1))}
                canPrev={index > 0}
                canNext={index < unlockedMax}
            />
            <p className="mb-3 text-center text-[15px] leading-relaxed">
                <span className="mr-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 font-black text-primary">{kindLabel}</span>
                {puzzle.tip}
            </p>

            <div className="mb-3 flex flex-wrap items-end justify-center gap-2" role="group" aria-label="可称量的方块">
                {puzzle.blocks.map((b) => {
                    const onPan = pans.left?.id === b.id || pans.right?.id === b.id
                    const m = DENSITY_MATERIALS[b.material]
                    return (
                        <button
                            key={b.id}
                            type="button"
                            onClick={() => placeOnPan(b)}
                            aria-pressed={onPan}
                            aria-label={`${m.name}${onPan ? "（在天平上）" : ""}`}
                            className={cn(
                                "flex min-h-11 min-w-[4.5rem] flex-col items-center gap-1 rounded-xl px-2 py-2 transition-colors",
                                onPan ? "bg-primary/15 ring-2 ring-primary/40" : "bg-muted/50 hover:bg-muted",
                            )}
                        >
                            <BlockView block={b} size="md" />
                            <span className="text-sm font-bold">{m.name}</span>
                        </button>
                    )
                })}
            </div>

            <div className="relative mx-auto mb-3 h-40 w-full max-w-sm select-none" data-testid="density-beam">
                <div className="absolute left-[10%] right-[10%] top-4 transition-transform duration-500 ease-out" style={{ transform: `rotate(${tilt}deg)` }}>
                    <div className="h-3 rounded-full bg-gradient-to-b from-stone-300 via-stone-500 to-stone-600 shadow-sm dark:from-stone-500 dark:via-stone-600 dark:to-stone-800" />
                    <div className="absolute -left-1 top-2.5 transition-transform duration-500" style={{ transform: `rotate(${-tilt}deg)` }}>{panContent(pans.left, "左")}</div>
                    <div className="absolute -right-1 top-2.5 transition-transform duration-500" style={{ transform: `rotate(${-tilt}deg)` }}>{panContent(pans.right, "右")}</div>
                </div>
                <div className="absolute bottom-2 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[18px] border-b-[72px] border-x-transparent border-b-foreground/45" />
                <div className="absolute bottom-1 left-1/2 h-2.5 w-24 -translate-x-1/2 rounded-full bg-foreground/45" />
            </div>

            {feedback ? <FeedbackLine>{feedback}</FeedbackLine> : null}

            {log.length ? (
                <ul className="mb-3 space-y-1 text-center text-[15px]" aria-label="称量记录">
                    {log.map((l) => <li key={l} className="text-muted-foreground">⚖ {l}</li>)}
                </ul>
            ) : null}

            <div className="mb-4">
                <p className="mb-2 text-center text-[15px] font-black">{goalLabel}</p>
                <div className="flex flex-wrap justify-center gap-2">
                    {puzzle.blocks.map((b) => {
                        const pos = answer.findIndex((x) => x.id === b.id)
                        return (
                            <Button
                                key={b.id}
                                variant={pos >= 0 ? "default" : "outline"}
                                className="min-h-11 rounded-full text-[15px]"
                                onClick={() => tapAnswer(b)}
                                disabled={isSolved}
                            >
                                {pos >= 0 && puzzle.goal === "sort" ? `${pos + 1}. ` : ""}{DENSITY_MATERIALS[b.material].name}
                            </Button>
                        )
                    })}
                </div>
            </div>

            {isSolved ? (
                <div className="mb-4 text-center" role="status">
                    <p className="mb-1 text-lg font-black text-primary"><Sparkles className="mr-1 inline h-5 w-5" />答对了！</p>
                    <p className="mb-2 text-[15px] leading-relaxed">{puzzle.takeaway}</p>
                    <ul className="mb-3 space-y-1 text-[15px]">
                        {puzzle.blocks.map((b) => (
                            <li key={b.id}>
                                {DENSITY_MATERIALS[b.material].name} ≈ <b>{blockDensity(b)} g/cm³</b>
                                <span className="text-muted-foreground">（{blockMass(b)} g ÷ {b.volume < 2 ? b.volume.toFixed(2) : b.volume}）</span>
                            </li>
                        ))}
                    </ul>
                    {index < DENSITY_PUZZLES.length - 1 ? (
                        <Button className="min-h-11 rounded-full" onClick={() => reset(index + 1)}>下一关：{DENSITY_PUZZLES[index + 1].name}</Button>
                    ) : null}
                </div>
            ) : null}

            <div className="flex justify-center">
                <LabLink experiment="density-measurement" label="去物理实验室：测密度" />
            </div>
        </div>
    )
}
