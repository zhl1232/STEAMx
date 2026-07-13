"use client"

import { useEffect } from "react"
import { Cpu, Lightbulb, RotateCcw, Sparkles, Trophy } from "lucide-react"
import { CIRCUIT_LEVELS, GATE_OPTIONS, useCircuit, type GateKind } from "@/hooks/playground/use-circuit"
import { useGamification } from "@/lib/context/gamification-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`
}

function gateLabel(kind: GateKind | null) {
    return kind ?? "选择门"
}

export default function CircuitPage() {
    const game = useCircuit()
    const { checkBadges } = useGamification()
    const lampOn = game.evaluation.output === true
    const targetMet = game.evaluation.complete && game.evaluation.output === game.level.targetOutput

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
            circuitSolved: game.stats.solvedLevels.length,
        })
    }, [checkBadges, game.stats.solvedLevels.length, game.status])

    return (
        <div className="playground-game-page">
            <div className="playground-game-main playground-game-center">
                <div className="w-full max-w-3xl playground-game-board">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-indigo-400/40 bg-indigo-500/10">
                                <Cpu className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black">逻辑电路 · {game.level.name}</h1>
                                <p className="text-xs text-muted-foreground">为门电路选类型，让输出灯达到目标状态。</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">{formatTime(game.time)}</span>
                            <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => game.startLevel(game.levelIndex)} aria-label="重开">
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2">
                        {CIRCUIT_LEVELS.map((level, index) => (
                            <Button key={level.id} size="sm" variant={game.levelIndex === index ? "default" : "outline"} onClick={() => game.startLevel(index)}>
                                {level.name}
                                {game.stats.solvedLevels.includes(level.id) ? <span className="ml-1">✓</span> : null}
                            </Button>
                        ))}
                    </div>

                    <p className="mb-4 text-xs text-muted-foreground">{game.level.hint}</p>

                    <div className="mb-4 flex flex-wrap items-center gap-3">
                        {game.inputs.map((value, index) => (
                            <button
                                key={`in-${index}`}
                                type="button"
                                disabled={game.level.lockInputs || game.status === "solved"}
                                onClick={() => game.toggleInput(index)}
                                className={cn(
                                    "min-h-11 rounded-md border px-4 text-sm font-black transition-colors",
                                    value
                                        ? "border-emerald-400/50 bg-emerald-500 text-white"
                                        : "border-border bg-muted text-muted-foreground",
                                    game.level.lockInputs && "opacity-80",
                                )}
                            >
                                IN{index} · {value ? "1" : "0"}
                            </button>
                        ))}
                        <div
                            className={cn(
                                "ml-auto flex min-h-11 items-center gap-2 rounded-md border px-4 font-black",
                                lampOn ? "border-amber-400/50 bg-amber-400 text-amber-950" : "border-border bg-muted text-muted-foreground",
                            )}
                        >
                            <Lightbulb className="h-4 w-4" />
                            输出 {game.evaluation.output == null ? "?" : game.evaluation.output ? "1" : "0"}
                            <span className="text-xs font-semibold opacity-80">目标 {game.level.targetOutput ? "1" : "0"}</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {game.level.gates.map((gate) => {
                            const kind = gate.fixed ?? game.assignments[gate.id] ?? null
                            const value = game.evaluation.values[gate.id]
                            return (
                                <div key={gate.id} className="rounded-lg border border-border bg-muted/20 p-3">
                                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                        <div className="text-sm font-bold">
                                            门 {gate.id.toUpperCase()}
                                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                                                输入：{gate.inputs.join(", ")}
                                            </span>
                                        </div>
                                        <span className="text-xs font-bold text-muted-foreground">
                                            当前 = {value == null ? "?" : value ? "1" : "0"}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {GATE_OPTIONS.filter((option) =>
                                            gate.inputs.length === 1 ? option === "NOT" : option !== "NOT",
                                        ).map((option) => (
                                            <Button
                                                key={option}
                                                size="sm"
                                                variant={kind === option ? "default" : "outline"}
                                                disabled={Boolean(gate.fixed) || game.status === "solved"}
                                                onClick={() => game.setGate(gate.id, option)}
                                            >
                                                {option}
                                            </Button>
                                        ))}
                                        {!gate.fixed ? (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                disabled={game.status === "solved"}
                                                onClick={() => game.setGate(gate.id, null)}
                                            >
                                                清除
                                            </Button>
                                        ) : (
                                            <span className="self-center text-xs text-muted-foreground">固定为 {gateLabel(gate.fixed)}</span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {game.status === "solved" || targetMet ? (
                        <div className="mt-4 rounded-lg border border-indigo-400/40 bg-indigo-500/10 p-4 text-center">
                            <Sparkles className="mx-auto mb-2 h-6 w-6 text-indigo-500" />
                            <p className="font-black">电路导通，目标达成！</p>
                            <p className="text-xs text-muted-foreground">{formatTime(game.time)}</p>
                        </div>
                    ) : null}
                </div>
            </div>

            <aside className="w-full border-t border-border bg-card/50 p-6 xl:w-96 xl:border-l xl:border-t-0">
                <div className="space-y-5">
                    <section>
                        <h2 className="mb-2 flex items-center gap-2 font-bold">
                            <Trophy className="h-4 w-4 text-indigo-500" />
                            通关用时
                        </h2>
                        <div className="space-y-2 text-xs">
                            {CIRCUIT_LEVELS.map((level) => (
                                <div key={level.id} className="flex justify-between rounded-md bg-muted/50 px-3 py-2">
                                    <span>{level.name}</span>
                                    <span className="font-bold">
                                        {game.stats.solvedLevels.includes(level.id)
                                            ? formatTime(game.stats.bestTimes[level.id] ?? 0)
                                            : "—"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                    <div className="space-y-1 text-xs text-muted-foreground">
                        <p>AND：全 1 才 1 · OR：有 1 就 1 · NOT：取反</p>
                        <p>NAND：AND 再取反 · XOR：输入不同才 1</p>
                    </div>
                </div>
            </aside>
        </div>
    )
}
