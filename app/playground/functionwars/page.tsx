"use client"

import {
    Suspense,
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type ReactNode,
    type SetStateAction,
} from "react"
import { useSearchParams } from "next/navigation"
import {
    Bomb,
    Check,
    ChevronRight,
    Circle,
    Crosshair,
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
    User,
    Zap,
    Expand,
    Minimize,
    type LucideIcon,
} from "lucide-react"

import { FunctionWarsOnlineView } from "@/components/features/playground/function-wars-online-view"
import { useTutorContext } from "@/components/features/tutor/tutor-context"
import { Button } from "@/components/ui/button"
import { useFunctionWarsImmersive } from "@/hooks/playground/use-function-wars-immersive"
import { BattleWeaponReadout, ImmersiveControls } from "./immersive-controls"
import { readFunctionWarsLabelExclusions } from "./canvas-overlays"
import { useFunctionWars, type FunctionWarsProjectileTrace } from "@/hooks/playground/use-function-wars"
import { useGamification } from "@/lib/context/gamification-context"
import {
    FUNCTION_WARS_CAMPAIGN_LEVELS,
    FUNCTION_WARS_CHALLENGE_LEVELS,
    FUNCTION_WARS_LEVELS,
    type FunctionWarsLevel,
    type FunctionWarsObstacle,
} from "@/lib/playground/function-wars-levels"
import type { FunctionName } from "@/lib/playground/function-plotter"
import {
    WEAPON_DEFINITIONS,
    type WeaponId,
} from "@/lib/playground/function-wars-weapons"
import { cn } from "@/lib/utils"
import { MathKeyboard, ParameterTools } from "./expression-tools"
import { getFunctionWarsFeedback } from "./feedback"
import { ObstacleLegend } from "./obstacle-legend"
import { getFunctionWarsMaxUnlockedIndex } from "./level-progress"
import {
    FUNCTION_WARS_CANVAS_ASPECT_RATIO,
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

const SINGLE_SHOT_PLAYBACK_MS = 1_250
const FUNCTION_WARS_LEVEL_DEV_MODE = process.env.NODE_ENV === "development"

function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`
}

function toRenderTrace(trace: FunctionWarsProjectileTrace, index: number): FunctionWarsRenderTrace {
    return {
        id: trace.id,
        weapon: trace.weaponId,
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

        const resize = () => {
            renderer.resize(container.clientWidth, window.devicePixelRatio, container.clientHeight)
            renderer.setLabelExclusions(readFunctionWarsLabelExclusions(canvas))
        }
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
        if (canvasRef.current) rendererRef.current?.setLabelExclusions(readFunctionWarsLabelExclusions(canvasRef.current))
        rendererRef.current?.setScene(scene)
    }, [scene])

    return { canvasRef, containerRef }
}

function Stars({ value, className }: { value: number; className?: string }) {
    return (
        <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${value} 星`}>
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
        <div className="grid h-11 grid-cols-2 border border-border bg-muted/45 p-0.5" role="group" aria-label="游戏模式" data-function-wars-mode>
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
                        "inline-flex min-w-0 items-center justify-center gap-2 px-3 text-xs font-semibold transition-colors",
                        mode === value
                            ? "bg-primary text-primary-foreground shadow-sm"
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
    bestStars = {},
    onSelect,
}: {
    current: number
    solved: Set<string>
    unlockAll?: boolean
    bestStars?: Record<string, number>
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

    return (
        <div className="function-wars-level-rail space-y-1.5" aria-label="关卡选择">
            {unlockAll ? (
                <p className="inline-flex items-center gap-1 bg-amber-500/12 px-2 py-1 text-[10px] font-semibold text-amber-800 dark:text-amber-200">
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
                        "min-h-8 px-3 text-[11px] font-semibold",
                        chapter === "campaign" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
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
                        "inline-flex min-h-8 items-center justify-center gap-1 px-3 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-45",
                        chapter === "challenge" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
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
                                aria-label={`第 ${level.number} 关 ${level.name}${locked ? "，未解锁" : isSolved ? bestStars[level.id] ? `，最好 ${bestStars[level.id]} 星` : "，已通过" : ""}`}
                                className={cn(
                                    "relative grid h-12 w-12 shrink-0 place-items-center border text-xs font-semibold transition-[transform,background-color,border-color] active:scale-[0.97]",
                                    current === index
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border bg-background text-muted-foreground hover:border-foreground/35 hover:text-foreground",
                                    locked && "cursor-not-allowed opacity-38",
                                )}
                            >
                                {locked ? <LockKeyhole className="h-3.5 w-3.5" aria-hidden /> : level.number}
                                <span className={cn("absolute bottom-1 h-1.5 w-1.5 rounded-full", THEME_DOT[level.theme])} />
                                {isSolved ? <span className="absolute right-0.5 top-0.5 text-[8px] text-amber-500" aria-hidden>{bestStars[level.id] ? "★".repeat(bestStars[level.id]) : "✓"}</span> : null}
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
        <div className="function-wars-weapon-bar flex flex-wrap gap-1.5" role="group" aria-label="选择武器">
            {available.map((weapon) => {
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
                            "relative grid min-h-11 min-w-20 place-items-center gap-0.5 border px-1 py-1.5 text-[10px] font-bold transition-[transform,background-color,border-color] active:scale-[0.97]",
                            selected === weapon
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                            !usable && "opacity-35",
                        )}
                    >
                        <Icon className={cn("h-4 w-4", selected === weapon ? "text-primary-foreground" : WEAPON_META[weapon].color)} aria-hidden />
                        <span className="w-full truncate">{definition.shortName}</span>
                        <span className="absolute right-1 top-0.5 font-mono text-[9px] tabular-nums">{count == null ? "∞" : count}</span>
                    </button>
                )
            })}
        </div>
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
    return labels.length > 0 ? `每发有效使用 ${labels.join("、")}` : null
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
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                <ListChecks className="h-3.5 w-3.5" aria-hidden />任务
                {!bonusComplete && mission?.bonusObjectives?.length ? <span className="ml-auto text-amber-700 dark:text-amber-300">三星目标未完成</span> : null}
            </p>
            {requirement ? <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-muted-foreground"><Sigma className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />{requirement}</p> : null}
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

function SinglePlayerView({ active, immersive, modeControls }: { active: boolean; immersive: boolean; modeControls: ReactNode }) {
    const game = useFunctionWars(0, active)
    const { checkBadges } = useGamification()
    const { setExpression, selectWeapon } = game
    const [feedbackMode, setFeedbackMode] = useState<"preview" | "last">("preview")
    const updateExpression = useCallback((value: SetStateAction<string>) => {
        setFeedbackMode("preview")
        setExpression(value)
    }, [setExpression])
    const chooseWeapon = useCallback((weapon: WeaponId) => {
        setFeedbackMode("preview")
        selectWeapon(weapon)
    }, [selectWeapon])
    const [toolsCloseVersion, setToolsCloseVersion] = useState(0)
    const [gridVisible, setGridVisible] = useState(false)
    const [previewVisible, setPreviewVisible] = useState(true)
    const [ghostVisible, setGhostVisible] = useState(true)
    const [ghostTraces, setGhostTraces] = useState<FunctionWarsRenderTrace[]>([])
    const [shotPlaybackActive, setShotPlaybackActive] = useState(false)
    const playbackTimerRef = useRef<number | null>(null)
    const resultRef = useRef<HTMLElement>(null)
    const errorRef = useRef<HTMLParagraphElement>(null)
    const battlefieldDescriptionId = useId()
    const CurrentWeaponIcon = WEAPON_META[game.selectedWeapon].icon
    const remainingTargets = game.enemies.filter((enemy) => enemy.hp > 0).length
    const remainingRelays = game.relays.filter((relay) => relay.active).length
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
        if (!immersive) node?.scrollIntoView?.({ block: "nearest" })
    }, [game.status, immersive, shotPlaybackActive])

    useEffect(() => {
        if (!game.error) return
        const node = errorRef.current
        node?.focus({ preventScroll: true })
        if (!immersive) node?.scrollIntoView?.({ block: "nearest" })
    }, [game.error, immersive])

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
    const impactedObstacle = game.level.obstacles.find((obstacle) => obstacle.id === lastImpactTrace?.hitId)
    const impactedObstacleId = impactedObstacle && !impactedObstacle.destructible ? impactedObstacle.id : undefined
    const impactMaterial = impactedObstacle?.material ?? (
        game.enemies.some((enemy) => enemy.id === lastImpactTrace?.hitId) ? "metal" : undefined
    )
    const showingPreview = Boolean(feedbackMode === "preview" && active && previewVisible && !shotPlaybackActive && game.status === "playing" && game.previewShot?.ok)
    const feedback = useMemo(() => {
        if (showingPreview && game.previewShot?.ok) return getFunctionWarsFeedback(game.level, game.previewShot.state, game.previewShot.shot)
        return game.lastShot ? getFunctionWarsFeedback(game.level, {
            status: game.status, lossReason: game.lossReason, effectiveFunctions: game.effectiveFunctions,
            enemies: game.enemies, shots: game.shots, relays: game.relays,
        }, game.lastShot) : null
    }, [showingPreview, game.previewShot, game.level, game.lastShot, game.status, game.lossReason, game.effectiveFunctions, game.enemies, game.shots, game.relays])
    const feedbackLabels = useMemo(() => !shotPlaybackActive && feedback
        ? feedback.endpoints.map((endpoint) => ({ ...endpoint, preview: showingPreview })) : [], [feedback, showingPreview, shotPlaybackActive])
    const bestSolution = game.stats.bestSolutions?.[game.level.id]
    const missingBonus = (game.level.mission?.bonusObjectives ?? []).filter((objective) => objective.kind === "function"
        ? !game.effectiveFunctions.includes(objective.function)
        : !game.effectiveWeapons.includes(objective.weapon))
    const scene = useMemo<FunctionWarsRenderScene>(() => ({
        feedbackLabels,
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
        traces: shotPlaybackActive || game.status !== "playing" ? activeTraces : [],
        ghostTraces: ghostVisible ? (shotPlaybackActive ? ghostTraces : activeTraces) : [],
        previewTraces: showingPreview && game.previewShot?.ok ? game.previewShot.shot.traces.map(toRenderTrace) : [],
        gridVisible,
        animationKey: game.lastShot ? `${game.level.id}-${game.lastShot.seq}` : null,
        animationDurationMs: SINGLE_SHOT_PLAYBACK_MS,
        impact: lastImpact && game.lastShot
            ? {
                id: `${game.level.id}-impact-${game.lastShot.seq}`,
                ...lastImpact,
                intensity: game.lastShot.weaponId === "heavy" ? 42 : 26,
                weapon: game.lastShot.weaponId,
                material: impactMaterial,
                unitId: destroyedUnitId,
                obstacleId: impactedObstacleId,
            }
            : null,
        activeSide: "player",
    }), [feedbackLabels, showingPreview, ghostVisible, activeTraces, destroyedUnitId, fallEvent, game.craters, game.crates, game.enemies, game.lastShot, game.level, game.playerAlive, game.relays, game.previewShot, game.status, shotPlaybackActive, ghostTraces, gridVisible, impactedObstacleId, impactMaterial, lastImpact])
    const { canvasRef, containerRef } = useCanvasScene(scene)

    const solved = useMemo(() => new Set(FUNCTION_WARS_LEVELS.filter(level => game.stats.solvedLevels.includes(level.id)).map(level => level.id)), [game.stats.solvedLevels])
    const threeStarCount = FUNCTION_WARS_LEVELS.filter(level => game.stats.bestStars?.[level.id] === 3).length
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
        setFeedbackMode("last")
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
        setFeedbackMode("preview")
        game.startLevel(index)
    }, [clearShotPlayback, game])

    return (
        <>
            <details hidden={immersive} className="function-wars-level-header mb-2 rounded-sm border border-border bg-background px-3">
                <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 py-2 text-xs font-semibold">
                    <span className="min-w-0"><span className="block">第 {game.level.number} 关 · {game.level.name}</span><span className="inline-flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground"><span>已射 {game.shots} / 建议 {game.level.par} 发</span><span className="inline-flex items-center gap-1 font-mono tabular-nums"><Timer className="h-3 w-3" aria-hidden />{formatTime(game.time)}</span></span></span>
                    <span className="shrink-0 text-primary">选择关卡⌄</span>
                </summary>
                <div className="pb-2"><LevelRail key={game.level.chapter} current={game.levelIndex} solved={solved} bestStars={game.stats.bestStars} unlockAll={FUNCTION_WARS_LEVEL_DEV_MODE} onSelect={handleStartLevel} /></div>
            </details>

            <div className="function-wars-battle-layout grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_330px] xl:items-start">
                <div className="function-wars-stage min-w-0" data-battle-theme={game.level.theme}>
                    <div className="function-wars-immersive-status" hidden={!immersive}>
                        <p className="function-wars-hud-title"><span className="function-wars-stage-number">{String(game.level.number).padStart(2, "0")}</span>{game.level.name}</p>
                        <p className="function-wars-hud-objective"><Target className="h-3 w-3" aria-hidden />剩余 {remainingTargets} 个目标{remainingRelays ? ` · ${remainingRelays} 个中继` : ""}<span className="function-wars-hud-shots">已射 {game.shots} 发</span></p>
                    </div>
                    <div className="function-wars-mission-chips" aria-label="关键任务进度" aria-live="polite">
                        {(game.level.mission?.effectiveFunctions ?? []).map((name) => <span key={name} data-complete={game.effectiveFunctions.includes(name)}>{game.effectiveFunctions.includes(name) ? "✓" : "○"} 有效 {name}</span>)}
                        {game.level.relays?.length ? <span data-complete={remainingRelays === 0}>中继 {game.level.relays.length - remainingRelays}/{game.level.relays.length}</span> : null}
                        {game.level.mission?.shotLimit !== undefined ? <span>剩余 {Math.max(0, game.level.mission.shotLimit - game.shots)} 发</span> : null}
                    </div>
                    <div className="function-wars-battlefield-shell relative w-full min-w-0">
                        <div
                            ref={containerRef}
                            style={{ aspectRatio: FUNCTION_WARS_CANVAS_ASPECT_RATIO }}
                            className="function-wars-canvas-frame relative w-full overflow-hidden rounded-sm border border-border bg-muted shadow-[0_18px_48px_-34px_hsl(var(--surface-shadow)/0.65)]"
                        >
                            <canvas
                                ref={canvasRef}
                                className="block h-full w-full"
                                aria-label="函数战争单人战场"
                                aria-describedby={battlefieldDescriptionId}
                                role="img"
                            />
                            <ObstacleLegend />
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

                        </div>
                        {gameEnded && !shotPlaybackActive ? (
                            <div className="function-wars-result-layer">
                                {game.status === "won" ? (
                                    <section ref={resultRef} tabIndex={-1} data-result="won" className="function-wars-result outline-none" aria-label="通关结算" aria-live="polite">
                                        <div className="function-wars-result-content">
                                            <div className="function-wars-result-heading">
                                                <p className="function-wars-result-title font-semibold">{game.levelIndex + 1 === game.levelCount ? solved.size >= game.levelCount ? "全关挑战完成！" : "最终关挑战完成！" : "目标清除"}</p>
                                                <Stars value={game.stars} className="function-wars-result-stars" />
                                            </div>
                                            <p className="function-wars-result-stats text-xs text-muted-foreground">第 {game.level.number} 关 · {game.shots} 发 · {formatTime(game.time)}</p>
                                            {game.stars < 3 ? <p className="mt-2 text-xs text-muted-foreground">想拿三星：{([...missingBonus.map((objective) => objective.label), ...(game.shots > game.level.par ? [`在建议的 ${game.level.par} 发内完成`] : [])].join("；") || `试着在建议的 ${game.level.par} 发内完成`)}。</p> : null}
                                            {game.levelIndex + 1 === game.levelCount ? <p className="mt-2 text-xs">已通过 {solved.size}/{game.levelCount} 关 · 三星 {threeStarCount}/{game.levelCount} 关。回选关继续集星，或保留函数再挑战。</p> : null}
                                            {game.levelIndex + 1 === game.levelCount ? <details className="mt-2"><summary className="min-h-11 cursor-pointer py-3 text-xs font-semibold">返回选关</summary><LevelRail current={game.levelIndex} solved={solved} bestStars={game.stats.bestStars} onSelect={handleStartLevel} /></details> : null}
                                        </div>
                                        <div className="function-wars-result-actions">
                                            {game.levelIndex + 1 < game.levelCount ? (
                                                <Button type="button" className="min-h-11 w-full gap-1" onClick={() => handleStartLevel(game.levelIndex + 1)}>
                                                    下一关<ChevronRight className="h-4 w-4" aria-hidden />
                                                </Button>
                                            ) : (
                                                <Button type="button" className="min-h-11 w-full gap-1" onClick={() => {
                                                    clearShotPlayback()
                                                    setGhostTraces([])
                                                    setFeedbackMode("preview")
                                                    game.retryLevel()
                                                }}><RotateCcw className="h-4 w-4" aria-hidden />保留函数再挑战</Button>
                                            )}
                                        </div>
                                    </section>
                                ) : null}
                                {game.status === "lost" ? (
                                    <section ref={resultRef} tabIndex={-1} data-result="lost" className="function-wars-result outline-none" aria-label="本关结算" aria-live="polite">
                                        <div className="function-wars-result-content">
                                            <p className="function-wars-result-kicker">再试一次</p>
                                            <p className="function-wars-result-title text-sm font-semibold">{game.lossReason === "mission_incomplete" ? "目标已清除，任务未完成" : game.lossReason === "shot_limit" ? "能源耗尽" : "承重坠落"}</p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                {game.lossReason === "mission_incomplete" ? `还需有效使用 ${game.level.mission?.effectiveFunctions?.filter((name) => !game.effectiveFunctions.includes(name)).join("、")}；重开后用它命中目标或中继。` : game.lossReason === "shot_limit" ? "射击次数已用完，本关任务尚未完成。" : "己方平台失去支撑，本关失败。"}
                                            </p>
                                        </div>
                                        <div className="function-wars-result-actions">
                                            <Button type="button" variant="outline" className="min-h-11 w-full gap-2" onClick={() => {
                                                clearShotPlayback()
                                                setGhostTraces([])
                                                setFeedbackMode("preview")
                                                game.retryLevel()
                                            }}><RotateCcw className="h-4 w-4" aria-hidden />重开本关</Button>
                                        </div>
                                    </section>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                </div>

                <section className="function-wars-control-panel min-w-0 max-w-full overflow-hidden rounded-md border border-border bg-[hsl(var(--surface-raised)/0.9)] p-3 sm:p-4" aria-label="单人炮术控制台">
                    <div className="function-wars-dock">
                        <BattleWeaponReadout name={WEAPON_DEFINITIONS[game.selectedWeapon].shortName} icon={CurrentWeaponIcon} ammunition={game.selectedWeapon === "standard" ? null : game.inventory[game.selectedWeapon]}>
                            <WeaponBar available={game.level.availableWeapons} inventory={game.inventory} selected={game.selectedWeapon} disabled={gameEnded || shotPlaybackActive} onSelect={chooseWeapon} />
                        </BattleWeaponReadout>
                    <label htmlFor="function-wars-expression" className="mt-4 block text-[11px] font-semibold text-muted-foreground">轨迹函数</label>
                    <div className="function-wars-input-row mt-1.5 grid min-w-0 grid-cols-[minmax(0,1fr)_44px_76px] items-stretch gap-2">
                        <div className="function-wars-expression-window flex min-w-0 items-center border border-border bg-background focus-within:border-foreground/35 focus-within:ring-2 focus-within:ring-amber-500/25">
                            <span className="pl-3 font-serif text-sm font-semibold text-muted-foreground" aria-hidden>f(x)=</span>
                            <input
                                id="function-wars-expression"
                                value={game.expression}
                                onChange={(event) => updateExpression(event.target.value)}
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
                                className="h-11 min-w-0 flex-1 bg-transparent px-1.5 font-mono text-base lg:text-sm font-bold outline-none disabled:opacity-55"
                            />
                        </div>
                        <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="function-wars-grid-toggle h-11 w-11 shrink-0"
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
                            className="function-wars-fire-button h-11 w-full shrink-0 gap-1" tone="warning"
                            onClick={handleFire}
                            disabled={gameEnded || shotPlaybackActive || !game.expression.trim()}
                            aria-label="发射"
                            title="发射"
                        >
                            <Send className="h-4 w-4" aria-hidden />发射
                        </Button>
                    </div>
                    {game.previewShot && !game.previewShot.ok && !gameEnded && !game.error ? <p className="function-wars-input-error mt-2 text-xs leading-5 text-destructive" role="status">{game.previewShot.error}</p> : null}
                    {game.error ? <p ref={errorRef} tabIndex={-1} className="function-wars-input-error mt-2 text-xs font-semibold text-destructive outline-none" role="alert">{game.error}</p> : null}
                    <ParameterTools key={game.level.id} expression={game.expression} onChange={updateExpression} disabled={gameEnded || shotPlaybackActive} immersive={immersive} onTemplateSelect={() => setToolsCloseVersion((value) => value + 1)} />
                    </div>
                    {game.weaponNotice ? <p className="function-wars-weapon-notice text-xs" role="status">{game.weaponNotice}</p> : null}
                    {feedback && !shotPlaybackActive ? <p className="function-wars-feedback text-xs" data-tone={feedback.tone} role="status"><strong>{showingPreview ? "预览：" : "上一发："}</strong>{feedback.summary}{showingPreview ? "；不消耗弹药。" : null}{feedback.detail ? <span className="block">{feedback.detail}</span> : null}</p> : null}
                    <ImmersiveControls immersive={immersive} closeVersion={toolsCloseVersion}>
                        <div hidden={!immersive} className="function-wars-mode-tools space-y-3 mb-3">
                            {modeControls}
                            <LevelRail current={game.levelIndex} solved={solved} bestStars={game.stats.bestStars} unlockAll={FUNCTION_WARS_LEVEL_DEV_MODE} onSelect={handleStartLevel} />
                        </div>
                    <div hidden={immersive}><WeaponBar
                        available={game.level.availableWeapons}
                        inventory={game.inventory}
                        selected={game.selectedWeapon}
                        disabled={gameEnded || shotPlaybackActive}
                        onSelect={chooseWeapon}
                    /></div>



                    {game.buffs.blastBoost || game.buffs.penetration ? (
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
                            {game.buffs.blastBoost ? <span className="inline-flex items-center gap-1 bg-red-500/12 px-2 py-1 text-red-700 dark:text-red-300"><Zap className="h-3 w-3" />爆炸增幅</span> : null}
                            {game.buffs.penetration ? <span className="inline-flex items-center gap-1 bg-amber-500/12 px-2 py-1 text-amber-800 dark:text-amber-200"><Drill className="h-3 w-3" />穿透强化</span> : null}
                        </div>
                    ) : null}

                    <p className="mt-1 text-xs leading-5 text-muted-foreground">炮口是 (0, 0)：x 向右，f(x) 是相对炮口的高度。</p>
                    <p className="mt-1 text-xs leading-5 text-foreground">{game.level.hint}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={previewVisible} onChange={(event) => setPreviewVisible(event.target.checked)} className="h-4 w-4 accent-primary" />试射预览</label>
                        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={ghostVisible} onChange={(event) => setGhostVisible(event.target.checked)} className="h-4 w-4 accent-primary" />上一发</label>
                    </div>
                    <MathKeyboard
                        setExpression={updateExpression}
                        disabled={gameEnded || shotPlaybackActive}
                        requiredTokens={requiredTokens}
                    />

                    {bestSolution ? <details className="mt-2 text-xs"><summary className="min-h-11 cursor-pointer py-3 font-semibold">本关最佳解法 · {bestSolution.stars} 星 / {bestSolution.shots} 发</summary><ol className="space-y-2">{bestSolution.steps.map((step, index) => <li key={index} className="flex flex-wrap items-center gap-2"><span>{index + 1}. {WEAPON_DEFINITIONS[step.weaponId].shortName} · <code>{step.expression}</code></span><button type="button" disabled={gameEnded || shotPlaybackActive} className="min-h-11 border px-3" onClick={() => { updateExpression(step.expression); chooseWeapon(step.weaponId) }}>载入第 {index + 1} 发</button></li>)}</ol><p>载入后先看预览，再自己发射。</p></details> : null}
                    <MissionChecklist
                        level={game.level}
                        shots={game.shots}
                        activeRelayCount={game.relays.filter((relay) => relay.active).length}
                        effectiveFunctions={game.effectiveFunctions}
                        effectiveWeapons={game.effectiveWeapons}
                        bonusComplete={game.bonusComplete}
                        playerAlive={game.playerAlive}
                    />

                    <details className="mt-2 text-xs text-muted-foreground"><summary className="min-h-11 cursor-pointer py-3 font-semibold">坐标与飞行规则</summary><p className="pb-2 leading-5">从炮口出发须满足 f(0)=0。0 表示水平发射，0.25*x 表示每前进 1 格升高 0.25 格。虚线预览不消耗弹药；浅色线是上一发。碰到目标或障碍、到达地图边界，或用完飞行距离时都会停下。弯曲越多，走过的路越长；函数中途无定义也会中断。</p></details>
                    <div className="function-wars-secondary mt-4 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
                        <Button type="button" size="sm" variant="outline" className="min-h-11 gap-2" disabled={shotPlaybackActive} onClick={() => {
                            clearShotPlayback()
                            setGhostTraces([])
                            setFeedbackMode("preview")
                            game.retryLevel()
                        }}>
                            <RotateCcw className="h-4 w-4" aria-hidden />重开本关
                        </Button>
                        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                            <PackageOpen className="h-3.5 w-3.5" aria-hidden />穿过道具箱即可拾取
                        </span>
                    </div>
                    </ImmersiveControls>
                </section>
            </div>
        </>
    )
}

function FunctionWarsPageInner() {
    const searchParams = useSearchParams()
    const { rootRef, isImmersive, enter, exit } = useFunctionWarsImmersive()
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
        if (isImmersive) requestAnimationFrame(() => {
            const nextControl = rootRef.current?.querySelector<HTMLButtonElement>(".function-wars-single-container:not([hidden]) .function-wars-operations-trigger, .function-wars-online-container:not([hidden]) .function-wars-operations-trigger")
            const control = nextControl ?? rootRef.current?.querySelector<HTMLButtonElement>(".function-wars-immersive-toggle")
            control?.focus({ preventScroll: true })
        })
    }, [isImmersive, rootRef])

    return (
        <main ref={rootRef} data-immersive={isImmersive} className={cn("function-wars-page mx-auto w-full px-3 py-2 sm:px-4 lg:px-6 lg:py-4", isImmersive && "function-wars-immersive")}>
            <Button type="button" variant="outline" className="function-wars-immersive-toggle min-h-11 gap-2" onClick={() => isImmersive ? exit() : void enter()}>
                {isImmersive ? <Minimize className="h-4 w-4" aria-hidden /> : <Expand className="h-4 w-4" aria-hidden />}
                {isImmersive ? "退出沉浸" : "展开战场"}
            </Button>
            <header hidden={isImmersive} className="function-wars-page-header mb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="hidden min-w-0 items-center gap-3 lg:flex">
                    <span className="grid h-11 w-11 shrink-0 place-items-center border border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                        <Crosshair className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                        <h1 className="truncate text-xl font-semibold text-foreground">函数战争</h1>
                        <p className="truncate text-xs text-muted-foreground">画一条函数，试着命中目标</p>
                    </div>
                </div>
                <div className="w-full md:w-[280px]">
                    <ModeSwitch mode={mode} onlineActive={onlineActive} onChange={changeMode} />
                </div>
            </header>

            <div className="function-wars-single-container" hidden={mode !== "single"} aria-hidden={mode !== "single"}>
                <SinglePlayerView active={mode === "single"} immersive={isImmersive} modeControls={<ModeSwitch mode={mode} onlineActive={onlineActive} onChange={changeMode} />} />
            </div>
            {onlineVisited ? (
                <div
                    className="function-wars-online-container"
                    hidden={mode !== "online"}
                    aria-hidden={mode !== "online"}
                >
                    <FunctionWarsOnlineView
                        immersive={isImmersive}
                        modeControls={<ModeSwitch mode={mode} onlineActive={onlineActive} onChange={changeMode} />}
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
