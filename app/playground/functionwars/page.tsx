"use client"

import {
    Suspense,
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type Dispatch,
    type SetStateAction,
} from "react"
import { useSearchParams } from "next/navigation"
import {
    AlertTriangle,
    Bomb,
    Check,
    ChevronRight,
    Circle,
    Crosshair,
    Delete,
    Drill,
    FlipHorizontal2,
    Globe2,
    Grid3X3,
    LockKeyhole,
    ListChecks,
    PackageOpen,
    Radio,
    RotateCcw,
    Send,
    Sigma,
    ShieldCheck,
    Split,
    Star,
    Target,
    Timer,
    Trophy,
    User,
    Zap,
    type LucideIcon,
} from "lucide-react"

import { FunctionWarsOnlineView } from "@/components/features/playground/function-wars-online-view"
import { useTutorContext } from "@/components/features/tutor/tutor-context"
import { Button } from "@/components/ui/button"
import { useFunctionWars, type FunctionWarsProjectileTrace } from "@/hooks/playground/use-function-wars"
import { useGamification } from "@/lib/context/gamification-context"
import {
    FUNCTION_WARS_CAMPAIGN_LEVELS,
    FUNCTION_WARS_CHALLENGE_LEVELS,
    FUNCTION_WARS_LEVELS,
    FUNCTION_WARS_SCENES,
    type FunctionWarsLevel,
    type FunctionWarsObstacle,
} from "@/lib/playground/function-wars-levels"
import type { FunctionName } from "@/lib/playground/function-plotter"
import {
    WEAPON_DEFINITIONS,
    type WeaponId,
} from "@/lib/playground/function-wars-weapons"
import { cn } from "@/lib/utils"
import {
    FunctionWarsRenderer,
    type FunctionWarsRenderScene,
    type FunctionWarsRenderTrace,
} from "./renderer"

type PageMode = "single" | "online"

const WEAPON_META: Record<WeaponId, { icon: LucideIcon; color: string }> = {
    standard: { icon: Crosshair, color: "text-emerald-700 dark:text-emerald-300" },
    heavy: { icon: Bomb, color: "text-red-700 dark:text-red-300" },
    drill: { icon: Drill, color: "text-amber-800 dark:text-amber-200" },
    split: { icon: Split, color: "text-sky-700 dark:text-sky-300" },
    mirror: { icon: FlipHorizontal2, color: "text-violet-700 dark:text-violet-300" },
}

const THEME_DOT = {
    grassland: "bg-emerald-500",
    canyon: "bg-red-500",
    space: "bg-cyan-500",
} as const

const MATH_KEYS = [
    "x", "+", "−", "×", "÷", "^", "(", ")", "sin(", "cos(", "tan(", "abs(", "sqrt(", "log(", "exp(", "pi",
] as const

const SINGLE_SHOT_PLAYBACK_MS = 1_250
const FUNCTION_WARS_LEVEL_DEV_MODE = process.env.NODE_ENV === "development"

function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`
}

export function getFunctionWarsMaxUnlockedIndex(solved: ReadonlySet<string>, unlockAll = false): number {
    if (unlockAll) return FUNCTION_WARS_LEVELS.length - 1
    let contiguousSolved = 0
    for (const level of FUNCTION_WARS_LEVELS) {
        if (!solved.has(level.id)) break
        contiguousSolved += 1
    }
    return Math.min(FUNCTION_WARS_LEVELS.length - 1, contiguousSolved)
}

function toRenderTrace(trace: FunctionWarsProjectileTrace, index: number): FunctionWarsRenderTrace {
    return {
        id: trace.id,
        points: trace.points,
        mirrored: trace.weaponId === "mirror" && index > 0,
        color: trace.fragment ? "#ef7a47" : undefined,
        sourceUnitId: trace.fragment ? undefined : "single-player",
    }
}

function toRenderObstacle(obstacle: FunctionWarsObstacle) {
    return obstacle.kind === "circle"
        ? {
            id: obstacle.id,
            shape: "circle" as const,
            x: obstacle.x,
            y: obstacle.y,
            radius: obstacle.radius,
            destructible: obstacle.destructible,
            material: obstacle.material,
        }
        : {
            id: obstacle.id,
            shape: "rect" as const,
            x: obstacle.x,
            y: obstacle.y,
            width: obstacle.width,
            height: obstacle.height,
            destructible: obstacle.destructible,
            material: obstacle.material,
        }
}

function useCanvasScene(scene: FunctionWarsRenderScene) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const rendererRef = useRef<FunctionWarsRenderer | null>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        const container = containerRef.current
        if (!canvas || !container) return

        const renderer = new FunctionWarsRenderer(canvas)
        rendererRef.current = renderer
        renderer.setScene(scene)
        renderer.start()

        const resize = () => renderer.resize(container.getBoundingClientRect().width)
        resize()
        const observer = new ResizeObserver(resize)
        observer.observe(container)

        return () => {
            observer.disconnect()
            renderer.destroy()
            rendererRef.current = null
        }
        // The renderer instance is stable; scene updates use the effect below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        rendererRef.current?.setScene(scene)
    }, [scene])

    return { canvasRef, containerRef }
}

function Stars({ value, className }: { value: number; className?: string }) {
    return (
        <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} 星`}>
            {Array.from({ length: 3 }, (_, index) => (
                <Star
                    key={index}
                    className={cn(
                        "h-4 w-4",
                        index < value ? "fill-amber-400 text-amber-500" : "fill-muted text-muted-foreground/35",
                    )}
                    aria-hidden
                />
            ))}
        </span>
    )
}

function ModeSwitch({
    mode,
    onlineActive,
    onChange,
}: {
    mode: PageMode
    onlineActive: boolean
    onChange: (mode: PageMode) => void
}) {
    return (
        <div className="grid h-11 grid-cols-2 border border-border bg-muted/45 p-0.5" role="group" aria-label="游戏模式">
            {([
                { value: "single" as const, label: "单人战役", icon: User },
                { value: "online" as const, label: "真人对战", icon: Globe2 },
            ]).map(({ value, label, icon: Icon }) => (
                <button
                    key={value}
                    type="button"
                    onClick={() => onChange(value)}
                    aria-pressed={mode === value}
                    className={cn(
                        "inline-flex min-w-0 items-center justify-center gap-2 px-3 text-xs font-black transition-colors",
                        mode === value
                            ? "bg-foreground text-background shadow-sm"
                            : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                    )}
                >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{label}</span>
                    {value === "online" && onlineActive ? (
                        <>
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                            <span className="sr-only">，有进行中的对局</span>
                        </>
                    ) : null}
                </button>
            ))}
        </div>
    )
}

function LevelRail({
    current,
    solved,
    unlockAll = false,
    onSelect,
}: {
    current: number
    solved: Set<string>
    unlockAll?: boolean
    onSelect: (index: number) => void
}) {
    const maxUnlockedIndex = getFunctionWarsMaxUnlockedIndex(solved, unlockAll)
    const currentLevel = FUNCTION_WARS_LEVELS[current]
    const [chapter, setChapter] = useState<"campaign" | "challenge">(
        currentLevel?.chapter === "challenge" ? "challenge" : "campaign",
    )
    const campaignComplete = FUNCTION_WARS_CAMPAIGN_LEVELS.every((level) => solved.has(level.id))
    const challengeUnlocked = unlockAll || campaignComplete
    const visibleLevels = chapter === "campaign" ? FUNCTION_WARS_CAMPAIGN_LEVELS : FUNCTION_WARS_CHALLENGE_LEVELS

    useEffect(() => {
        setChapter(currentLevel?.chapter === "challenge" ? "challenge" : "campaign")
    }, [currentLevel?.chapter])

    return (
        <div className="function-wars-level-rail space-y-1.5" aria-label="关卡选择">
            {unlockAll ? (
                <p className="inline-flex items-center gap-1 bg-amber-500/12 px-2 py-1 text-[10px] font-black text-amber-800 dark:text-amber-200">
                    <Zap className="h-3 w-3" aria-hidden />
                    开发模式：全部关卡已解锁
                </p>
            ) : null}
            <div className="function-wars-chapter-switch grid w-full max-w-64 grid-cols-2 border border-border bg-muted/45 p-0.5" role="group" aria-label="关卡章节">
                <button
                    type="button"
                    onClick={() => setChapter("campaign")}
                    aria-pressed={chapter === "campaign"}
                    className={cn(
                        "min-h-8 px-3 text-[11px] font-black",
                        chapter === "campaign" ? "bg-foreground text-background" : "text-muted-foreground",
                    )}
                >
                    战役 1-10
                </button>
                <button
                    type="button"
                    disabled={!challengeUnlocked}
                    onClick={() => setChapter("challenge")}
                    aria-pressed={chapter === "challenge"}
                    className={cn(
                        "inline-flex min-h-8 items-center justify-center gap-1 px-3 text-[11px] font-black disabled:cursor-not-allowed disabled:opacity-45",
                        chapter === "challenge" ? "bg-foreground text-background" : "text-muted-foreground",
                    )}
                >
                    {!challengeUnlocked ? <LockKeyhole className="h-3 w-3" aria-hidden /> : null}
                    挑战 11-15
                </button>
            </div>
            <div className="function-wars-level-scroller overflow-x-auto pb-1">
                <div className="flex min-w-max gap-1.5">
                    {visibleLevels.map((level) => {
                        const index = FUNCTION_WARS_LEVELS.indexOf(level)
                        const isSolved = solved.has(level.id)
                        const locked = index > maxUnlockedIndex && !isSolved
                        return (
                            <button
                                key={level.id}
                                type="button"
                                disabled={locked}
                                onClick={() => onSelect(index)}
                                aria-current={current === index ? "step" : undefined}
                                aria-label={`第 ${level.number} 关 ${level.name}${locked ? "，未解锁" : ""}`}
                                className={cn(
                                    "relative grid h-12 w-12 shrink-0 place-items-center border text-xs font-black transition-[transform,background-color,border-color] active:scale-[0.97]",
                                    current === index
                                        ? "border-foreground bg-foreground text-background"
                                        : "border-border bg-background text-muted-foreground hover:border-foreground/35 hover:text-foreground",
                                    locked && "cursor-not-allowed opacity-38",
                                )}
                            >
                                {locked ? <LockKeyhole className="h-3.5 w-3.5" aria-hidden /> : level.number}
                                <span className={cn("absolute bottom-1 h-1.5 w-1.5 rounded-full", THEME_DOT[level.theme])} />
                                {isSolved ? <Star className="absolute right-0.5 top-0.5 h-2.5 w-2.5 fill-amber-400 text-amber-500" aria-hidden /> : null}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

function WeaponBar({
    available,
    inventory,
    selected,
    disabled,
    onSelect,
}: {
    available: readonly WeaponId[]
    inventory: Record<Exclude<WeaponId, "standard">, number>
    selected: WeaponId
    disabled: boolean
    onSelect: (weapon: WeaponId) => void
}) {
    return (
        <div className="function-wars-weapon-bar grid grid-cols-5 gap-1.5" role="group" aria-label="选择武器">
            {(Object.keys(WEAPON_DEFINITIONS) as WeaponId[]).map((weapon) => {
                const definition = WEAPON_DEFINITIONS[weapon]
                const count = weapon === "standard" ? null : inventory[weapon]
                const usable = available.includes(weapon) && (weapon === "standard" || (count ?? 0) > 0)
                const Icon = WEAPON_META[weapon].icon
                return (
                    <button
                        key={weapon}
                        type="button"
                        disabled={disabled || !usable}
                        onClick={() => onSelect(weapon)}
                        aria-pressed={selected === weapon}
                        title={definition.description}
                        className={cn(
                            "relative grid min-h-14 min-w-0 place-items-center gap-0.5 border px-1 py-1.5 text-[10px] font-bold transition-[transform,background-color,border-color] active:scale-[0.97]",
                            selected === weapon
                                ? "border-foreground bg-foreground text-background"
                                : "border-border bg-background text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                            !usable && "opacity-35",
                        )}
                    >
                        <Icon className={cn("h-4 w-4", selected === weapon ? "text-background" : WEAPON_META[weapon].color)} aria-hidden />
                        <span className="w-full truncate">{definition.shortName}</span>
                        <span className="absolute right-1 top-0.5 font-mono text-[9px] tabular-nums">{count == null ? "∞" : count}</span>
                    </button>
                )
            })}
        </div>
    )
}

function MathKeyboard({
    setExpression,
    disabled,
    requiredTokens,
}: {
    setExpression: Dispatch<SetStateAction<string>>
    disabled: boolean
    requiredTokens: ReadonlySet<string>
}) {
    const [expanded, setExpanded] = useState(false)
    const append = useCallback((token: string) => {
        setExpression((current) => {
            const replacesZero = !["+", "−", "×", "÷", "^", ")"].includes(token)
            return current === "0" && replacesZero ? token : `${current}${token}`
        })
    }, [setExpression])

    return (
        <>
            <button
                type="button"
                className="function-wars-keyboard-toggle mt-2 hidden min-h-11 w-full items-center justify-center gap-2 border border-border bg-background text-xs font-black"
                onClick={() => setExpanded((current) => !current)}
                aria-expanded={expanded}
            >
                <Sigma className="h-4 w-4" aria-hidden />数学键盘
            </button>
            <div
                className={cn("function-wars-math-keyboard mt-2 grid grid-cols-5 gap-1 lg:hidden", expanded && "is-expanded")}
                aria-label="数学快捷键盘"
            >
                {MATH_KEYS.map((token) => (
                    <button
                        key={token}
                        type="button"
                        disabled={disabled}
                        onClick={() => append(token)}
                        className={cn(
                            "min-h-11 border border-border bg-background font-mono text-xs font-black text-foreground active:scale-[0.97] disabled:opacity-50",
                            requiredTokens.has(token) && "border-amber-500 bg-amber-500/14 text-amber-900 dark:text-amber-100",
                        )}
                    >
                        {token}
                    </button>
                ))}
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setExpression((current) => current.slice(0, -1))}
                    className="col-span-3 inline-flex min-h-11 items-center justify-center gap-1 border border-border bg-background text-xs font-bold text-muted-foreground disabled:opacity-50"
                >
                    <Delete className="h-3.5 w-3.5" aria-hidden />删除
                </button>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setExpression("")}
                    className="col-span-2 min-h-11 border border-border bg-background text-xs font-bold text-muted-foreground disabled:opacity-50"
                >
                    清空
                </button>
            </div>
        </>
    )
}

function missionRequirementText(level: FunctionWarsLevel): string | null {
    const rule = level.mission?.expressionRule
    if (!rule) return null
    const labels: string[] = [
        ...(rule.allFunctions ?? []),
        ...(rule.constants ?? []).map((constant) => constant === "pi" ? "π" : constant),
    ]
    if (rule.anyFunctions?.length) labels.push(rule.anyFunctions.join(" 或 "))
    return labels.length > 0 ? `每发包含 ${labels.join("、")}` : null
}

function MissionChecklist({
    level,
    shots,
    activeRelayCount,
    effectiveFunctions,
    effectiveWeapons,
    bonusComplete,
    playerAlive,
}: {
    level: FunctionWarsLevel
    shots: number
    activeRelayCount: number
    effectiveFunctions: readonly FunctionName[]
    effectiveWeapons: readonly WeaponId[]
    bonusComplete: boolean
    playerAlive: boolean
}) {
    const mission = level.mission
    const relayTotal = level.relays?.length ?? 0
    if (!mission && relayTotal === 0) return null
    const requirement = missionRequirementText(level)
    const effectiveRequired = mission?.effectiveFunctions ?? []
    const rows: Array<{ label: string; complete: boolean; icon: LucideIcon }> = []
    if (requirement) rows.push({ label: requirement, complete: true, icon: Sigma })
    if (relayTotal > 0) rows.push({
        label: `信号中继 ${relayTotal - activeRelayCount}/${relayTotal}`,
        complete: activeRelayCount === 0,
        icon: Radio,
    })
    for (const name of effectiveRequired) rows.push({
        label: `有效使用 ${name}`,
        complete: effectiveFunctions.includes(name),
        icon: Sigma,
    })
    if (mission?.shotLimit !== undefined) rows.push({
        label: `剩余射击 ${Math.max(0, mission.shotLimit - shots)}`,
        complete: shots < mission.shotLimit,
        icon: Target,
    })
    if (mission?.protectPlayer) rows.push({ label: "保护己方平台", complete: playerAlive, icon: ShieldCheck })
    for (const objective of mission?.bonusObjectives ?? []) {
        const complete = objective.kind === "function"
            ? effectiveFunctions.includes(objective.function)
            : effectiveWeapons.includes(objective.weapon)
        rows.push({ label: `三星：${objective.label}`, complete, icon: Star })
    }

    return (
        <div className="function-wars-mission mt-3 border border-border/80 bg-background/55 p-2.5" aria-label="本关任务">
            <p className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground">
                <ListChecks className="h-3.5 w-3.5" aria-hidden />任务
                {!bonusComplete && mission?.bonusObjectives?.length ? <span className="ml-auto text-amber-700 dark:text-amber-300">三星目标未完成</span> : null}
            </p>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-1">
                {rows.map(({ label, complete, icon: Icon }) => (
                    <p key={label} className={cn("flex min-w-0 items-center gap-1.5 text-[11px] font-bold", complete ? "text-emerald-700 dark:text-emerald-300" : "text-foreground")}>
                        <span className="grid h-4 w-4 shrink-0 place-items-center" aria-hidden>
                            {complete ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
                        </span>
                        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{label}</span>
                    </p>
                ))}
            </div>
        </div>
    )
}

function SinglePlayerView({ active }: { active: boolean }) {
    const game = useFunctionWars(0, active)
    const { checkBadges } = useGamification()
    const [gridVisible, setGridVisible] = useState(true)
    const [ghostTraces, setGhostTraces] = useState<FunctionWarsRenderTrace[]>([])
    const [shotPlaybackActive, setShotPlaybackActive] = useState(false)
    const playbackTimerRef = useRef<number | null>(null)
    const resultRef = useRef<HTMLElement>(null)
    const errorRef = useRef<HTMLParagraphElement>(null)
    const battlefieldDescriptionId = useId()
    const campaignSolved = FUNCTION_WARS_CAMPAIGN_LEVELS.filter((level) => game.stats.solvedLevels.includes(level.id)).length
    const challengeSolved = FUNCTION_WARS_CHALLENGE_LEVELS.filter((level) => game.stats.solvedLevels.includes(level.id)).length

    const clearShotPlayback = useCallback(() => {
        if (playbackTimerRef.current !== null) {
            window.clearTimeout(playbackTimerRef.current)
            playbackTimerRef.current = null
        }
        setShotPlaybackActive(false)
    }, [])

    useEffect(() => () => {
        if (playbackTimerRef.current !== null) window.clearTimeout(playbackTimerRef.current)
    }, [])

    useEffect(() => {
        if (shotPlaybackActive || game.status === "playing") return
        const node = resultRef.current
        node?.focus({ preventScroll: true })
        node?.scrollIntoView?.({ block: "nearest" })
    }, [game.status, shotPlaybackActive])

    useEffect(() => {
        if (!game.error) return
        const node = errorRef.current
        node?.focus({ preventScroll: true })
        node?.scrollIntoView?.({ block: "nearest" })
    }, [game.error])

    useEffect(() => {
        if (game.status !== "won") return
        checkBadges({
            projectsPublished: 0, projectsLiked: 0, projectsCompleted: 0,
            commentsCount: 0, scienceCompleted: 0, techCompleted: 0,
            engineeringCompleted: 0, artCompleted: 0, mathCompleted: 0,
            likesGiven: 0, likesReceived: 0, collectionsCount: 0,
            challengesJoined: 0, level: 1, loginDays: 0, consecutiveDays: 0,
            discussionsCreated: 0, repliesCount: 0,
            minesweeperWins: 0, minesweeperExpertWins: 0, minesweeperBestTime: 999,
            functionWarsSolved: campaignSolved,
            functionWarsChallengeSolved: challengeSolved,
        })
    }, [campaignSolved, challengeSolved, checkBadges, game.status])

    const activeTraces = useMemo(
        () => game.lastShot?.traces.map(toRenderTrace) ?? [],
        [game.lastShot],
    )
    const fallEvent = game.lastShot?.falls[0]
    const fallenRenderUnitId = fallEvent
        ? fallEvent.side === "player" ? "single-player" : fallEvent.unitId
        : undefined
    const destroyedUnitId = fallenRenderUnitId ?? game.lastShot?.damage.find((event) => event.remainingHp <= 0)?.enemyId
    const lastImpactTrace = game.lastShot?.traces.findLast((trace) => trace.impact)
    const lastImpact = lastImpactTrace?.impact
    const impactedObstacleId = lastImpactTrace?.hitId && game.level.obstacles.some(
        (obstacle) => obstacle.id === lastImpactTrace.hitId && !obstacle.destructible,
    )
        ? lastImpactTrace.hitId
        : undefined
    const scene = useMemo<FunctionWarsRenderScene>(() => ({
        theme: game.level.theme,
        groundVisible: game.level.ground !== "void",
        obstacles: game.level.obstacles.map(toRenderObstacle),
        craters: game.craters,
        units: [
            {
                id: "single-player",
                ...game.level.player,
                side: "player",
                facing: "right",
                alive: game.playerAlive,
                falling: fallEvent?.side === "player",
            },
            ...game.enemies.map((enemy) => ({
                id: enemy.id,
                ...enemy.position,
                side: "enemy" as const,
                facing: "left" as const,
                hp: enemy.hp,
                maxHp: enemy.maxHp,
                armored: enemy.type === "armored",
                alive: enemy.hp > 0,
                falling: fallEvent?.unitId === enemy.id,
            })),
        ],
        crates: [
            ...game.crates.map((crate) => ({
                id: crate.id,
                ...crate.position,
                type: crate.pickup,
                active: crate.active,
            })),
            ...game.relays.map((relay) => ({
                id: relay.id,
                ...relay.position,
                type: "relay" as const,
                active: relay.active,
            })),
        ],
        traces: activeTraces,
        ghostTraces,
        gridVisible,
        animationKey: game.lastShot ? `${game.level.id}-${game.lastShot.seq}` : null,
        animationDurationMs: SINGLE_SHOT_PLAYBACK_MS,
        impact: lastImpact && game.lastShot
            ? {
                id: `${game.level.id}-impact-${game.lastShot.seq}`,
                ...lastImpact,
                intensity: game.lastShot.weaponId === "heavy" ? 42 : 26,
                unitId: destroyedUnitId,
                obstacleId: impactedObstacleId,
            }
            : null,
        activeSide: "player",
    }), [activeTraces, destroyedUnitId, fallEvent, game.craters, game.crates, game.enemies, game.lastShot, game.level, game.playerAlive, game.relays, ghostTraces, gridVisible, impactedObstacleId, lastImpact])
    const { canvasRef, containerRef } = useCanvasScene(scene)

    const solved = useMemo(() => new Set(game.stats.solvedLevels), [game.stats.solvedLevels])
    const sceneMeta = FUNCTION_WARS_SCENES[game.level.theme]
    const gameEnded = game.status !== "playing"
    const requiredTokens = useMemo(() => {
        const rule = game.level.mission?.expressionRule
        return new Set([
            ...(rule?.allFunctions ?? []).map((name) => `${name}(`),
            ...(rule?.anyFunctions ?? []).map((name) => `${name}(`),
            ...(rule?.constants ?? []).map((constant) => constant),
        ])
    }, [game.level.mission?.expressionRule])

    const handleFire = useCallback(() => {
        if (shotPlaybackActive) return
        const previous = game.lastShot?.traces.map(toRenderTrace) ?? []
        const outcome = game.fire()
        if (!outcome?.ok) return
        if (previous.length > 0) setGhostTraces(previous)
        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
        if (reduceMotion) return
        setShotPlaybackActive(true)
        playbackTimerRef.current = window.setTimeout(() => {
            playbackTimerRef.current = null
            setShotPlaybackActive(false)
        }, SINGLE_SHOT_PLAYBACK_MS + 50)
    }, [game, shotPlaybackActive])

    const handleStartLevel = useCallback((index: number) => {
        clearShotPlayback()
        setGhostTraces([])
        game.startLevel(index)
    }, [clearShotPlayback, game])

    return (
        <>
            <div className="function-wars-level-header mb-3 border-y border-border/75 bg-[hsl(var(--surface-raised)/0.76)] px-3 py-2.5 sm:border sm:px-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="truncate text-xs font-black text-foreground">关卡 {game.level.number} · {game.level.name}</p>
                        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{sceneMeta.name} · PAR {game.level.par}</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold text-muted-foreground">
                        {game.level.chapter === "challenge" ? `挑战 ${challengeSolved}/5` : `战役 ${campaignSolved}/10`}
                    </span>
                </div>
                <div className="mt-2.5">
                    <LevelRail
                        current={game.levelIndex}
                        solved={solved}
                        unlockAll={FUNCTION_WARS_LEVEL_DEV_MODE}
                        onSelect={handleStartLevel}
                    />
                </div>
            </div>

            <div className="function-wars-battle-layout grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_330px] xl:items-start">
                <div className="min-w-0">
                    <div className="function-wars-battlefield-shell relative left-1/2 w-[100dvw] max-w-[100dvw] -translate-x-1/2 px-[max(12px,env(safe-area-inset-left))] md:static md:w-full md:max-w-none md:translate-x-0 md:px-0">
                        <div
                            ref={containerRef}
                            className="relative aspect-3/2 w-full overflow-hidden border border-foreground/20 bg-[#d8e2d5] shadow-[0_18px_48px_-34px_hsl(var(--surface-shadow)/0.65)]"
                        >
                            <canvas
                                ref={canvasRef}
                                className="block h-full w-full"
                                aria-label="函数战争单人战场"
                                aria-describedby={battlefieldDescriptionId}
                                role="img"
                            />
                            <p id={battlefieldDescriptionId} className="sr-only">
                                我方炮台位于 x {game.level.player.x}、y {game.level.player.y}。
                                {game.enemies.map((enemy) =>
                                    `敌方 ${enemy.id} 位于 x ${enemy.position.x}、y ${enemy.position.y}，生命值 ${enemy.hp}/${enemy.maxHp}。`,
                                ).join(" ")}
                                当前有 {game.level.obstacles.length} 个障碍、{game.crates.filter((crate) => crate.active).length} 个可拾取道具、
                                {game.relays.filter((relay) => relay.active).length} 个未连接中继器。
                                {missionRequirementText(game.level) ? `任务要求：${missionRequirementText(game.level)}。` : ""}
                                {game.level.mission?.shotLimit !== undefined
                                    ? `剩余 ${Math.max(0, game.level.mission.shotLimit - game.shots)} 发。`
                                    : ""}
                                {game.lastShot
                                    ? `上一发函数 ${game.lastShot.expression}，造成 ${game.lastShot.damage.reduce((sum, event) => sum + event.damage, 0)} 点伤害。`
                                    : "尚未发射。"}
                            </p>
                            <div className="pointer-events-none absolute left-2 top-2 bg-[#223236]/88 px-2 py-1 font-mono text-[10px] font-bold text-[#f1ebd6]">
                                L{game.level.number.toString().padStart(2, "0")} / {game.level.theme.toUpperCase()}
                            </div>
                            <div className="pointer-events-none absolute right-2 top-2 flex gap-1.5 text-[10px] font-bold">
                                <span className="inline-flex items-center gap-1 bg-[#f4ecd4]/92 px-2 py-1 text-[#263437]"><Target className="h-3 w-3" />{game.shots}/{game.level.par}</span>
                                <span className="inline-flex items-center gap-1 bg-[#223236]/88 px-2 py-1 font-mono text-[#f1ebd6]"><Timer className="h-3 w-3" />{formatTime(game.time)}</span>
                            </div>
                            {game.lastShot ? (
                                <div className="pointer-events-none absolute bottom-2 left-2 max-w-[78%] truncate bg-[#f4ecd4]/92 px-2 py-1 font-mono text-[10px] font-bold text-[#263437] shadow-sm">
                                    f(x)={game.lastShot.expression}
                                </div>
                            ) : null}
                        </div>
                    </div>

                    {game.status === "won" && !shotPlaybackActive ? (
                        <section ref={resultRef} tabIndex={-1} className="mt-3 border border-emerald-500/35 bg-emerald-500/9 px-4 py-3 outline-none" aria-live="polite">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="grid h-10 w-10 place-items-center bg-emerald-600 text-white"><Trophy className="h-5 w-5" aria-hidden /></span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-black">目标清除</p>
                                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                                        <Stars value={game.stars} />
                                        <span>{game.shots} 发 · {formatTime(game.time)}</span>
                                    </div>
                                </div>
                                {game.levelIndex + 1 < game.levelCount ? (
                                    <Button type="button" size="sm" className="min-h-11 gap-1" onClick={() => handleStartLevel(game.levelIndex + 1)}>
                                        下一关<ChevronRight className="h-4 w-4" aria-hidden />
                                    </Button>
                                ) : null}
                            </div>
                        </section>
                    ) : null}
                    {game.status === "lost" && !shotPlaybackActive ? (
                        <section ref={resultRef} tabIndex={-1} className="mt-3 border border-red-500/35 bg-red-500/9 px-4 py-3 outline-none" aria-live="polite">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="grid h-10 w-10 place-items-center bg-red-600 text-white"><AlertTriangle className="h-5 w-5" aria-hidden /></span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-black">{game.lossReason === "shot_limit" ? "能源耗尽" : "承重坠落"}</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        {game.lossReason === "shot_limit" ? "射击次数已用完，本关任务尚未完成。" : "己方平台失去支撑，本关失败。"}
                                    </p>
                                </div>
                                <Button type="button" size="sm" variant="outline" className="min-h-11 gap-2" onClick={() => {
                                    clearShotPlayback()
                                    setGhostTraces([])
                                    game.retryLevel()
                                }}>
                                    <RotateCcw className="h-4 w-4" aria-hidden />重开本关
                                </Button>
                            </div>
                        </section>
                    ) : null}
                </div>

                <section className="function-wars-control-panel min-w-0 max-w-full overflow-hidden border border-border/85 bg-[hsl(var(--surface-raised)/0.9)] p-3 sm:p-4" aria-label="单人炮术控制台">
                    <WeaponBar
                        available={game.level.availableWeapons}
                        inventory={game.inventory}
                        selected={game.selectedWeapon}
                        disabled={gameEnded || shotPlaybackActive}
                        onSelect={game.selectWeapon}
                    />

                    <MissionChecklist
                        level={game.level}
                        shots={game.shots}
                        activeRelayCount={game.relays.filter((relay) => relay.active).length}
                        effectiveFunctions={game.effectiveFunctions}
                        effectiveWeapons={game.effectiveWeapons}
                        bonusComplete={game.bonusComplete}
                        playerAlive={game.playerAlive}
                    />

                    {game.buffs.blastBoost || game.buffs.penetration ? (
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
                            {game.buffs.blastBoost ? <span className="inline-flex items-center gap-1 bg-red-500/12 px-2 py-1 text-red-700 dark:text-red-300"><Zap className="h-3 w-3" />爆炸增幅</span> : null}
                            {game.buffs.penetration ? <span className="inline-flex items-center gap-1 bg-amber-500/12 px-2 py-1 text-amber-800 dark:text-amber-200"><Drill className="h-3 w-3" />穿透强化</span> : null}
                        </div>
                    ) : null}

                    <label htmlFor="function-wars-expression" className="mt-4 block text-[11px] font-black text-muted-foreground">轨迹函数</label>
                    <div className="mt-1.5 grid min-w-0 grid-cols-[minmax(0,1fr)_44px_44px] items-stretch gap-2 max-[359px]:grid-cols-[minmax(0,1fr)_44px]">
                        <div className="flex min-w-0 items-center border border-border bg-background focus-within:border-foreground/35 focus-within:ring-2 focus-within:ring-amber-500/25 max-[359px]:col-span-2">
                            <span className="pl-3 font-serif text-sm font-black text-muted-foreground" aria-hidden>f(x)=</span>
                            <input
                                id="function-wars-expression"
                                value={game.expression}
                                onChange={(event) => game.setExpression(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault()
                                        handleFire()
                                    }
                                }}
                                disabled={gameEnded || shotPlaybackActive}
                                spellCheck={false}
                                autoComplete="off"
                                inputMode="text"
                                className="h-11 min-w-0 flex-1 bg-transparent px-1.5 font-mono text-sm font-bold outline-none disabled:opacity-55"
                            />
                        </div>
                        <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-11 w-11 shrink-0"
                            onClick={() => setGridVisible((visible) => !visible)}
                            aria-label={gridVisible ? "隐藏坐标网格" : "显示坐标网格"}
                            aria-pressed={gridVisible}
                            title={gridVisible ? "隐藏坐标网格" : "显示坐标网格"}
                        >
                            <Grid3X3 className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                            type="button"
                            size="icon"
                            className="h-11 w-11 shrink-0 bg-amber-500 text-[#282d2c] hover:bg-amber-400"
                            onClick={handleFire}
                            disabled={gameEnded || shotPlaybackActive || !game.expression.trim()}
                            aria-label="发射"
                            title="发射"
                        >
                            <Send className="h-4 w-4" aria-hidden />
                        </Button>
                    </div>
                    {game.error ? <p ref={errorRef} tabIndex={-1} className="mt-2 text-xs font-semibold text-destructive outline-none" role="alert">{game.error}</p> : null}
                    <MathKeyboard
                        setExpression={game.setExpression}
                        disabled={gameEnded || shotPlaybackActive}
                        requiredTokens={requiredTokens}
                    />

                    <div className="function-wars-secondary mt-4 border-t border-border/70 pt-3">
                        <div className="flex items-start gap-2">
                            <Sigma className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700 dark:text-cyan-300" aria-hidden />
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase text-muted-foreground">函数族线索</p>
                                <p className="mt-1 text-xs font-semibold leading-5 text-foreground">{game.level.hint}</p>
                            </div>
                        </div>
                    </div>

                    <div className="function-wars-secondary mt-4 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
                        <Button type="button" size="sm" variant="outline" className="min-h-11 gap-2" disabled={shotPlaybackActive} onClick={() => {
                            clearShotPlayback()
                            setGhostTraces([])
                            game.retryLevel()
                        }}>
                            <RotateCcw className="h-4 w-4" aria-hidden />重开本关
                        </Button>
                        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                            <PackageOpen className="h-3.5 w-3.5" aria-hidden />穿过道具箱即可拾取
                        </span>
                    </div>
                </section>
            </div>
        </>
    )
}

function FunctionWarsPageInner() {
    const searchParams = useSearchParams()
    const { setOverride: setTutorOverride, clearOverride: clearTutorOverride } = useTutorContext()
    const initialRoomCode = searchParams.get("room")
    const [mode, setMode] = useState<PageMode>(initialRoomCode ? "online" : "single")
    const [onlineVisited, setOnlineVisited] = useState(Boolean(initialRoomCode))
    const [onlineActive, setOnlineActive] = useState(false)

    useEffect(() => {
        setTutorOverride({
            subtitle: "正在看函数战争关卡",
            quickPrompts: ["这关适合哪类函数？", "怎样调整平移和缩放？", "为什么弹道在这里中断？"],
            hideFabOnMobile: true,
        })
        return clearTutorOverride
    }, [clearTutorOverride, setTutorOverride])

    const changeMode = useCallback((nextMode: PageMode) => {
        setMode(nextMode)
        if (nextMode === "online") setOnlineVisited(true)
    }, [])

    return (
        <main className="function-wars-page mx-auto w-full max-w-[1480px] py-3 sm:px-4 sm:py-5 lg:px-6">
            <header className="function-wars-page-header mb-3 flex flex-col gap-3 px-3 sm:px-0 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center border border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                        <Crosshair className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                        <h1 className="truncate text-xl font-black text-foreground">函数战争</h1>
                        <p className="truncate text-xs text-muted-foreground">Function Wars · 用函数图像控制弹道</p>
                    </div>
                </div>
                <div className="w-full md:w-[280px]">
                    <ModeSwitch mode={mode} onlineActive={onlineActive} onChange={changeMode} />
                </div>
            </header>

            <div hidden={mode !== "single"} aria-hidden={mode !== "single"}>
                <SinglePlayerView active={mode === "single"} />
            </div>
            {onlineVisited ? (
                <div
                    className="px-3 sm:px-0"
                    hidden={mode !== "online"}
                    aria-hidden={mode !== "online"}
                >
                    <FunctionWarsOnlineView
                        initialRoomCode={initialRoomCode}
                        onActiveMatchChange={setOnlineActive}
                    />
                </div>
            ) : null}
        </main>
    )
}

export default function FunctionWarsPage() {
    return (
        <Suspense fallback={<div className="min-h-[60dvh]" aria-label="正在加载函数战争" />}>
            <FunctionWarsPageInner />
        </Suspense>
    )
}
