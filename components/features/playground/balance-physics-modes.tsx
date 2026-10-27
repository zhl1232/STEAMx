"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, Check, FlaskConical, Minus, Plus, RotateCcw, Sparkles } from "lucide-react"
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

function LevelTabs({
    items, index, solved, onPick, label,
}: { items: Array<{ id: string; name: string }>; index: number; solved: string[]; onPick: (i: number) => void; label: string }) {
    return (
        <div className="no-scrollbar -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={label}>
            {items.map((item, i) => {
                const active = i === index
                const done = solved.includes(item.id)
                const locked = i > 0 && !solved.includes(items[i - 1].id) && !done
                return (
                    <button
                        key={item.id}
                        type="button"
                        disabled={locked}
                        onClick={() => onPick(i)}
                        aria-pressed={active}
                        className={cn(
                            "min-h-11 shrink-0 rounded-md border px-3 text-[15px] font-bold transition-colors",
                            active
                                ? "border-teal-700 bg-teal-800 text-white dark:border-teal-200 dark:bg-teal-100 dark:text-teal-950"
                                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                            locked && "cursor-not-allowed opacity-60",
                        )}
                    >
                        {i + 1}. {item.name}
                        {done ? <Check className="ml-1 inline h-4 w-4 text-emerald-500" /> : null}
                    </button>
                )
            })}
        </div>
    )
}

function LabLink({ experiment, label }: { experiment: string; label: string }) {
    return (
        <Link
            href={`/playground/physics-lab?experiment=${experiment}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-teal-400/50 bg-teal-500/10 px-4 text-[15px] font-bold text-teal-800 hover:bg-teal-500/20 dark:text-teal-200"
        >
            <FlaskConical className="h-4 w-4" />
            {label}
            <ArrowRight className="h-4 w-4" />
        </Link>
    )
}

function Feedback({ tone, children }: { tone: "info" | "good" | "warn"; children: React.ReactNode }) {
    return (
        <div
            role="status"
            aria-live="polite"
            className={cn(
                "mb-4 rounded-lg border p-3 text-[15px] font-semibold leading-relaxed",
                tone === "good" && "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/35 dark:bg-emerald-500/10 dark:text-emerald-200",
                tone === "warn" && "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/10 dark:text-amber-100",
                tone === "info" && "border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-400/35 dark:bg-teal-500/10 dark:text-teal-100",
            )}
        >
            {children}
        </div>
    )
}

/* ====================== 杠杆平衡 ====================== */

export function LeverMode() {
    const { solved, markSolved } = useProgress("leverSolved")
    const [index, setIndex] = useState(0)
    const [right, setRight] = useState<Record<number, number>>({})
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

    const pick = (i: number) => { setIndex(i); setRight({}) }
    const add = (d: number) => {
        if (isSolved || used >= puzzle.maxWeights) return
        setRight((r) => ({ ...r, [d]: (r[d] ?? 0) + 1 }))
    }
    const remove = (d: number) => {
        if (isSolved) return
        setRight((r) => ({ ...r, [d]: Math.max(0, (r[d] ?? 0) - 1) }))
    }

    const verdict = used === 0
        ? "在右边的挂点上点 ＋ 放砝码。"
        : leftT === rightT
          ? `左边 ${describeLever(puzzle.left)} = ${leftT}，右边 ${describeLever(right)} = ${rightT}，相等 → 杠杆平衡！`
          : leftT > rightT
            ? `左边 ${describeLever(puzzle.left)} = ${leftT}，右边 ${describeLever(right)} = ${rightT}，左边大 → 向左倾。`
            : `左边 ${describeLever(puzzle.left)} = ${leftT}，右边 ${describeLever(right)} = ${rightT}，右边大 → 向右倾。`

    // 视图：beam 宽度上 9 个位置（-4..4）
    const pegX = (side: -1 | 1, d: number) => 50 + side * d * 11

    return (
        <div>
            <LevelTabs items={LEVER_PUZZLES} index={index} solved={solved} onPick={pick} label="杠杆关卡" />
            <p className="mb-3 text-[15px] leading-relaxed text-foreground">
                <span className="font-black">目标：</span>{puzzle.tip}
                <span className="ml-1 font-bold text-muted-foreground">（砝码 {used}/{puzzle.maxWeights}）</span>
            </p>

            <div className="relative mx-auto mb-4 w-full max-w-2xl select-none rounded-lg border border-border bg-muted/30 px-2 pb-3 pt-6">
                <div className="relative h-40 sm:h-48">
                    <div
                        className="absolute left-0 right-0 top-6 transition-transform duration-500 ease-out"
                        style={{ transform: `rotate(${tilt}deg)` }}
                        data-testid="lever-beam"
                    >
                        <div className="mx-[4%] h-3 rounded-full bg-teal-700 dark:bg-teal-300" />
                        {([-1, 1] as const).flatMap((side) =>
                            LEVER_PEGS.map((d) => {
                                const count = side === -1 ? puzzle.left[d] ?? 0 : right[d] ?? 0
                                return (
                                    <div key={`${side}-${d}`} className="absolute top-3 flex -translate-x-1/2 flex-col items-center" style={{ left: `${pegX(side, d)}%` }}>
                                        <span className="h-3 w-0.5 bg-foreground/50" />
                                        {Array.from({ length: count }).map((_, k) => (
                                            <span
                                                key={k}
                                                className={cn(
                                                    "mt-0.5 h-4 w-6 rounded-sm border sm:w-8",
                                                    side === -1 ? "border-rose-700 bg-rose-500" : "border-sky-700 bg-sky-500",
                                                )}
                                            />
                                        ))}
                                    </div>
                                )
                            }),
                        )}
                    </div>
                    {/* 支点 */}
                    <div className="absolute left-1/2 top-9 h-0 w-0 -translate-x-1/2 border-x-[14px] border-b-[26px] border-x-transparent border-b-foreground/70" />
                    {/* 刻度 */}
                    <div className="absolute bottom-0 left-0 right-0 flex text-sm font-bold text-muted-foreground">
                        {[4, 3, 2, 1, 0, 1, 2, 3, 4].map((d, i) => (
                            <span key={i} className="absolute -translate-x-1/2" style={{ left: `${50 + (i - 4) * 11}%` }}>{d === 0 ? "▲" : d}</span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="右侧挂点">
                {LEVER_PEGS.map((d) => (
                    <div key={d} className="flex flex-col items-center gap-1 rounded-md border border-border bg-background p-1.5">
                        <span className="text-sm font-bold text-muted-foreground">右 {d} 格 · {right[d] ?? 0} 个</span>
                        <div className="flex w-full gap-1">
                            <Button variant="outline" className="h-11 flex-1 px-0" onClick={() => remove(d)} disabled={!right[d] || isSolved} aria-label={`从右 ${d} 格拿走一个砝码`}>
                                <Minus className="h-4 w-4" />
                            </Button>
                            <Button className="h-11 flex-1 px-0" onClick={() => add(d)} disabled={used >= puzzle.maxWeights || isSolved} aria-label={`在右 ${d} 格加一个砝码`}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            <Feedback tone={isSolved ? "good" : used >= puzzle.maxWeights && !balanced ? "warn" : "info"}>
                {verdict}
                {!isSolved && used >= puzzle.maxWeights && !balanced ? " 砝码用完了，拿走一个换个位置。" : null}
                {balanced && used > puzzle.maxWeights ? " 但砝码超出数量。" : null}
            </Feedback>

            {isSolved ? (
                <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50/70 p-4 dark:border-emerald-400/35 dark:bg-emerald-500/10">
                    <p className="mb-1 flex items-center gap-2 text-lg font-black"><Sparkles className="h-5 w-5 text-emerald-500" />平衡啦！</p>
                    <p className="mb-3 text-[15px] leading-relaxed">杠杆平衡条件：<b>F₁ × L₁ = F₂ × L₂</b>。力臂越长，需要的力越小——这就是撬棍、剪刀省力的秘密。</p>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" className="min-h-11" onClick={() => setRight({})}><RotateCcw className="mr-1 h-4 w-4" />换种挂法</Button>
                        {index < LEVER_PUZZLES.length - 1 ? (
                            <Button className="min-h-11" onClick={() => pick(index + 1)}>下一关：{LEVER_PUZZLES[index + 1].name}</Button>
                        ) : null}
                    </div>
                </div>
            ) : (
                <div className="mb-4 flex justify-end">
                    <Button variant="outline" className="min-h-11" onClick={() => setRight({})}><RotateCcw className="mr-1 h-4 w-4" />清空右边</Button>
                </div>
            )}

            <LabLink experiment="lever" label="去物理实验室：让杠杆平衡" />
        </div>
    )
}

/* ====================== 密度比较 ====================== */

function BlockView({ block, size }: { block: DensityBlock; size: "sm" | "md" }) {
    const m = DENSITY_MATERIALS[block.material]
    // 视觉边长 ∝ 体积的立方根（夹在合理范围内）
    const edge = Math.max(26, Math.min(64, Math.cbrt(block.volume) * 20))
    const px = size === "sm" ? edge * 0.75 : edge
    return (
        <span
            className={cn("inline-grid place-items-center rounded-md border border-black/20 text-base shadow-sm", m.color)}
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
                const line = r === "equal" ? `${L} 和 ${R} 一样重（平衡）` : r === "left" ? `${L} 比 ${R} 重（左边下沉）` : `${R} 比 ${L} 重（右边下沉）`
                setLog((l) => [line, ...l.filter((x) => x !== line)].slice(0, 4))
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
    const goalLabel = puzzle.goal === "pick-densest" ? "点选密度最大的那个" : `按密度从小到大依次点选（${answer.length}/${puzzle.blocks.length}）`

    const panContent = (b: DensityBlock | null, label: string) => (
        <div className="flex h-20 w-24 flex-col items-center justify-end rounded-b-full border-b-4 border-foreground/50 pb-1 sm:w-32">
            {b ? <BlockView block={b} size="sm" /> : <span className="text-sm font-bold text-muted-foreground">{label}</span>}
        </div>
    )

    const feedback = useMemo(() => {
        if (verdict === "right") return null
        if (verdict === "wrong") return puzzle.goal === "pick-densest" ? "不对哦。再称一称：体积相同时看谁更重；质量相同时看谁更小。" : "顺序不对。点已选的方块可以撤回，再用天平比一比。"
        if (result === "equal") return puzzle.kind === "same-mass" ? "天平平衡：它们质量相同。那体积越小的，密度就越大。" : "天平平衡。"
        if (result) return `${puzzle.kind === "same-volume" ? "体积相同，" : ""}下沉的一边更重${puzzle.kind === "same-volume" ? "，所以密度更大" : ""}。`
        return "点上面的方块放到天平上（先左后右），比较轻重。"
    }, [puzzle, result, verdict])

    return (
        <div>
            <LevelTabs items={DENSITY_PUZZLES} index={index} solved={solved} onPick={(i) => reset(i)} label="密度关卡" />
            <p className="mb-3 text-[15px] leading-relaxed">
                <span className="mr-1 rounded-full bg-teal-500/15 px-2 py-0.5 font-black text-teal-800 dark:text-teal-200">{kindLabel}</span>
                {puzzle.tip}
            </p>

            <div className="mb-3 flex flex-wrap items-end justify-center gap-3" role="group" aria-label="可称量的方块">
                {puzzle.blocks.map((b) => {
                    const onPan = pans.left?.id === b.id || pans.right?.id === b.id
                    const m = DENSITY_MATERIALS[b.material]
                    return (
                        <button
                            key={b.id}
                            type="button"
                            onClick={() => placeOnPan(b)}
                            aria-pressed={onPan}
                            aria-label={`${m.name}，体积 ${b.volume} 立方厘米${onPan ? "（在天平上）" : ""}`}
                            className={cn(
                                "flex min-h-11 min-w-20 flex-col items-center gap-1 rounded-lg border p-2 transition-colors",
                                onPan ? "border-teal-500 bg-teal-500/15" : "border-border bg-background hover:bg-muted",
                            )}
                        >
                            <BlockView block={b} size="md" />
                            <span className="text-sm font-bold">{m.name}</span>
                            <span className="text-sm text-muted-foreground">{b.volume < 2 ? b.volume.toFixed(1) : b.volume} cm³</span>
                        </button>
                    )
                })}
            </div>

            <div className="relative mx-auto mb-3 h-40 w-full max-w-md select-none">
                <div className="absolute left-[10%] right-[10%] top-4 transition-transform duration-500 ease-out" style={{ transform: `rotate(${tilt}deg)` }} data-testid="density-beam">
                    <div className="h-2.5 rounded-full bg-teal-700 dark:bg-teal-300" />
                    <div className="absolute -left-2 top-2 transition-transform duration-500" style={{ transform: `rotate(${-tilt}deg)` }}>{panContent(pans.left, "左盘")}</div>
                    <div className="absolute -right-2 top-2 transition-transform duration-500" style={{ transform: `rotate(${-tilt}deg)` }}>{panContent(pans.right, "右盘")}</div>
                </div>
                <div className="absolute bottom-0 left-1/2 h-32 w-2 -translate-x-1/2 rounded-full bg-foreground/60" />
                <div className="absolute bottom-0 left-1/2 h-2 w-24 -translate-x-1/2 rounded-full bg-foreground/60" />
            </div>

            {feedback ? <Feedback tone={verdict === "wrong" ? "warn" : "info"}>{feedback}</Feedback> : null}

            {log.length ? (
                <ul className="mb-4 space-y-1 text-[15px]" aria-label="称量记录">
                    {log.map((l) => <li key={l} className="rounded-md bg-muted/50 px-3 py-1.5">⚖️ {l}</li>)}
                </ul>
            ) : null}

            <div className="mb-4 rounded-lg border border-border p-3">
                <p className="mb-2 text-[15px] font-black">{goalLabel}</p>
                <div className="flex flex-wrap gap-2">
                    {puzzle.blocks.map((b) => {
                        const pos = answer.findIndex((x) => x.id === b.id)
                        return (
                            <Button
                                key={b.id}
                                variant={pos >= 0 ? "default" : "outline"}
                                className="min-h-11 text-[15px]"
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
                <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50/70 p-4 dark:border-emerald-400/35 dark:bg-emerald-500/10" role="status">
                    <p className="mb-1 flex items-center gap-2 text-lg font-black"><Sparkles className="h-5 w-5 text-emerald-500" />答对了！</p>
                    <p className="mb-2 text-[15px] leading-relaxed">{puzzle.takeaway}</p>
                    <ul className="mb-3 grid gap-1 text-[15px] sm:grid-cols-2">
                        {puzzle.blocks.map((b) => (
                            <li key={b.id} className="rounded-md bg-background/70 px-3 py-1.5">
                                {DENSITY_MATERIALS[b.material].name}：{blockMass(b)} g ÷ {b.volume < 2 ? b.volume.toFixed(2) : b.volume} cm³ ≈ <b>{blockDensity(b)} g/cm³</b>
                            </li>
                        ))}
                    </ul>
                    {index < DENSITY_PUZZLES.length - 1 ? (
                        <Button className="min-h-11" onClick={() => reset(index + 1)}>下一关：{DENSITY_PUZZLES[index + 1].name}</Button>
                    ) : null}
                </div>
            ) : null}

            <LabLink experiment="density-measurement" label="去物理实验室：天平与排水法测密度" />
        </div>
    )
}
