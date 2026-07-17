"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import {
    Bomb,
    ChevronRight,
    Crosshair,
    Delete,
    Drill,
    FlipHorizontal2,
    Grid3X3,
    Loader2,
    LogOut,
    Radio,
    RefreshCw,
    Send,
    Shield,
    Split,
    Timer,
    Zap,
    type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/context/auth-context"
import { useFunctionWarsOnline } from "@/hooks/playground/use-function-wars-online"
import {
    WEAPON_DEFINITIONS,
    type WeaponId,
} from "@/lib/playground/function-wars-weapons"
import {
    addFunctionWarsRepairsToMap,
    availableFunctionWarsCrates,
    opponentFunctionWarsRole,
    type FunctionWarsPlayerInventory,
    type FunctionWarsWeaponId,
} from "@/lib/playground/function-wars-online"
import {
    simulateFunctionWarsOnlineShot as simulateSharedFunctionWarsOnlineShot,
    type FunctionWarsOnlineShotSimulation,
} from "@/lib/playground/function-wars-simulation"
import {
    FunctionWarsRenderer,
    type FunctionWarsRenderScene,
} from "@/app/playground/functionwars/renderer"
import { FunctionWarsOnlineLobby } from "@/components/features/playground/function-wars-online-lobby"

const ACTIVE_MATCH_KEY = "function_wars_online_active_match"
const PLAYBACK_MS = 1280

const WEAPON_META: Record<WeaponId, { icon: LucideIcon; accent: string }> = {
    standard: { icon: Crosshair, accent: "text-emerald-700 dark:text-emerald-300" },
    heavy: { icon: Bomb, accent: "text-red-700 dark:text-red-300" },
    drill: { icon: Drill, accent: "text-amber-700 dark:text-amber-300" },
    split: { icon: Split, accent: "text-sky-700 dark:text-sky-300" },
    mirror: { icon: FlipHorizontal2, accent: "text-violet-700 dark:text-violet-300" },
}

function useCanvasRenderer(scene: FunctionWarsRenderScene, enabled: boolean) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const rendererRef = useRef<FunctionWarsRenderer | null>(null)

    useEffect(() => {
        if (!enabled) return
        const canvas = canvasRef.current
        const container = containerRef.current
        if (!canvas || !container) return
        const renderer = new FunctionWarsRenderer(canvas)
        rendererRef.current = renderer
        const resize = () => renderer.resize(container.getBoundingClientRect().width, window.devicePixelRatio)
        resize()
        renderer.setScene(scene)
        renderer.start()
        const observer = new ResizeObserver(resize)
        observer.observe(container)
        return () => {
            observer.disconnect()
            renderer.destroy()
            rendererRef.current = null
        }
        // Renderer lifetime follows the battle canvas mount; scene updates use the effect below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled])

    useEffect(() => {
        if (enabled) rendererRef.current?.setScene(scene)
    }, [enabled, scene])

    return { canvasRef, containerRef }
}

function HpMeter({ label, value, active, side }: { label: string; value: number; active: boolean; side: "host" | "guest" }) {
    const ratio = Math.max(0, Math.min(100, value))
    return (
        <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                <span className={cn(active ? "text-foreground" : "text-muted-foreground", side === "guest" && "sm:order-2")}>{label}</span>
                <span className="font-mono tabular-nums text-foreground">{Math.round(value)}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden bg-foreground/12">
                <div
                    className={cn("h-full origin-left transition-transform duration-500", ratio > 45 ? "bg-emerald-500" : ratio > 20 ? "bg-amber-500" : "bg-red-500")}
                    style={{ transform: `scaleX(${ratio / 100})` }}
                />
            </div>
        </div>
    )
}

function OnlineWeaponBar({
    inventory,
    selected,
    onSelect,
    disabled,
}: {
    inventory: FunctionWarsPlayerInventory
    selected: FunctionWarsWeaponId
    onSelect: (weapon: FunctionWarsWeaponId) => void
    disabled: boolean
}) {
    return (
        <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="选择武器">
            {(Object.keys(WEAPON_DEFINITIONS) as FunctionWarsWeaponId[]).map((weapon) => {
                const definition = WEAPON_DEFINITIONS[weapon]
                const count = weapon === "standard" ? null : inventory[weapon]
                const available = weapon === "standard" || (count ?? 0) > 0
                const Icon = WEAPON_META[weapon].icon
                return (
                    <button
                        key={weapon}
                        type="button"
                        onClick={() => onSelect(weapon)}
                        disabled={disabled || !available}
                        aria-pressed={selected === weapon}
                        title={definition.description}
                        className={cn(
                            "relative grid min-h-14 min-w-0 place-items-center gap-0.5 rounded-sm border px-1 py-1.5 text-[10px] font-bold transition-[transform,background-color,border-color] active:scale-[0.97]",
                            selected === weapon
                                ? "border-foreground/55 bg-foreground text-background"
                                : "border-border bg-background text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                            !available && "opacity-35",
                        )}
                    >
                        <Icon className={cn("h-4 w-4", selected === weapon ? "text-background" : WEAPON_META[weapon].accent)} aria-hidden />
                        <span className="w-full truncate">{definition.shortName}</span>
                        <span className="absolute right-1 top-0.5 font-mono text-[9px] tabular-nums">{count == null ? "∞" : count}</span>
                    </button>
                )
            })}
        </div>
    )
}

function appendAtEnd(setValue: React.Dispatch<React.SetStateAction<string>>, token: string) {
    setValue((current) => `${current}${token}`)
}

export function FunctionWarsOnlineView({
    initialRoomCode,
    onActiveMatchChange,
}: {
    initialRoomCode?: string | null
    onActiveMatchChange?: (active: boolean) => void
}) {
    const online = useFunctionWarsOnline()
    const { loading: authLoading, user } = useAuth()
    const bootstrappedRef = useRef(false)
    const [expression, setExpression] = useState("0")
    const [selectedWeapon, setSelectedWeapon] = useState<FunctionWarsWeaponId>("standard")
    const [gridVisible, setGridVisible] = useState(true)
    const [preview, setPreview] = useState<FunctionWarsOnlineShotSimulation | null>(null)
    const [localPlaybackActive, setLocalPlaybackActive] = useState(false)
    const [localPlaybackKey, setLocalPlaybackKey] = useState(0)
    const [seenShotSeq, setSeenShotSeq] = useState(0)
    const [secondsLeft, setSecondsLeft] = useState(60)
    const [inputError, setInputError] = useState<string | null>(null)
    const errorRef = useRef<HTMLParagraphElement>(null)
    const battlefieldDescriptionId = useId()

    useEffect(() => {
        onActiveMatchChange?.(online.phase === "waiting" || online.phase === "playing")
    }, [onActiveMatchChange, online.phase])

    useEffect(() => {
        if (!inputError && !online.error) return
        const node = errorRef.current
        node?.focus({ preventScroll: true })
        node?.scrollIntoView?.({ block: "nearest" })
    }, [inputError, online.error])

    useEffect(() => {
        if (bootstrappedRef.current || typeof window === "undefined" || authLoading || online.phase !== "idle" || !user) return
        bootstrappedRef.current = true
        const code = initialRoomCode?.trim().toUpperCase()
        if (code?.length === 6) {
            void online.joinRoom(code)
            return
        }
        const stored = window.localStorage.getItem(ACTIVE_MATCH_KEY)
        if (stored) void online.reconnect(stored)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, initialRoomCode, online.phase, user])

    useEffect(() => {
        setSeenShotSeq(0)
        setPreview(null)
        setLocalPlaybackActive(false)
    }, [online.matchId])

    useEffect(() => {
        if (!online.lastShot || online.shotSeq <= seenShotSeq) return
        if (localPlaybackActive && online.lastShot.by === online.myRole) return
        const timer = window.setTimeout(() => setSeenShotSeq(online.shotSeq), PLAYBACK_MS + 180)
        return () => window.clearTimeout(timer)
    }, [localPlaybackActive, online.lastShot, online.myRole, online.shotSeq, seenShotSeq])

    useEffect(() => {
        if (!online.turnDeadlineAt || online.phase !== "playing") {
            setSecondsLeft(60)
            return
        }
        const update = () => setSecondsLeft(Math.max(0, Math.ceil((new Date(online.turnDeadlineAt!).getTime() - Date.now()) / 1000)))
        update()
        const timer = window.setInterval(update, 250)
        return () => window.clearInterval(timer)
    }, [online.phase, online.turnDeadlineAt])

    const role = online.myRole
    const myInventory = role ? online.inventory[role] : null
    useEffect(() => {
        if (!myInventory || selectedWeapon === "standard") return
        if (myInventory[selectedWeapon] <= 0) setSelectedWeapon("standard")
    }, [myInventory, selectedWeapon])

    const replay = useMemo(() => {
        if (!online.lastShot || !online.baseMap) return null
        const shot = online.lastShot
        const replayMap = addFunctionWarsRepairsToMap(
            online.baseMap,
            online.repairs,
            shot.seq,
        )
        const replayCraters = online.craters.filter((crater) => crater.shot_seq < shot.seq)
        const replayCrates = online.crates.map((crate) =>
            crate.picked_seq === shot.seq
                ? { ...crate, picked_by: null, picked_seq: null }
                : crate,
        )
        const shooterInventory = {
            ...online.inventory[shot.by],
            blast_boost: shot.buffs_used.blast_boost,
            penetration: shot.buffs_used.penetration,
        }
        return simulateSharedFunctionWarsOnlineShot({
            expression: shot.expression,
            role: shot.by,
            weapon: shot.weapon,
            map: replayMap,
            crates: availableFunctionWarsCrates(replayCrates, shot.seq - 1),
            craters: replayCraters,
            inventory: shooterInventory,
        })
    }, [online.baseMap, online.craters, online.crates, online.inventory, online.lastShot, online.repairs])

    const replayIsActive = Boolean(online.lastShot && online.shotSeq > seenShotSeq)
    const activePreview = preview && localPlaybackActive ? preview : replayIsActive ? replay : null
    const ghostPreview = !localPlaybackActive && !replayIsActive ? replay : null

    const scene = useMemo<FunctionWarsRenderScene>(() => {
        const map = online.map
        if (!map) {
            return {
                theme: "canyon",
                obstacles: [],
                craters: [],
                units: [],
                crates: [],
                traces: [],
                gridVisible,
            }
        }
        const available = availableFunctionWarsCrates(online.crates, online.shotSeq)
        const units = (["host", "guest"] as const).map((unitRole) => ({
            id: `online-${unitRole}`,
            ...map.turrets[unitRole],
            side: unitRole,
            facing: unitRole === "host" ? "right" as const : "left" as const,
            hp: online.hp[unitRole],
            maxHp: 100,
            alive: online.hp[unitRole] > 0,
            shield: online.inventory[unitRole].shield,
        }))
        const impact = activePreview?.impact
            ? {
                ...activePreview.impact,
                id: `${localPlaybackActive ? `local-${localPlaybackKey}` : `online-${online.shotSeq}`}-${activePreview.impact.id}`,
            }
            : null
        return {
            theme: map.theme,
            obstacles: map.obstacles.map((obstacle) => ({ ...obstacle, shape: obstacle.shape })),
            craters: online.craters,
            units,
            crates: available.map((crate) => ({ ...crate, active: true })),
            traces: activePreview?.traces ?? [],
            ghostTraces: ghostPreview?.traces ?? [],
            gridVisible,
            animationKey: activePreview
                ? localPlaybackActive
                    ? `local-${online.matchId}-${localPlaybackKey}`
                    : `shot-${online.shotSeq}-${online.lastShot?.seq ?? "server"}`
                : null,
            animationDurationMs: PLAYBACK_MS,
            impact,
            activeSide: online.currentTurn,
        }
    }, [activePreview, ghostPreview, gridVisible, localPlaybackActive, localPlaybackKey, online.craters, online.crates, online.currentTurn, online.hp, online.inventory, online.lastShot?.seq, online.map, online.matchId, online.shotSeq])
    const battleCanvasEnabled = online.phase === "playing" || online.phase === "finished"
    const { canvasRef, containerRef } = useCanvasRenderer(scene, battleCanvasEnabled)

    const handleFire = useCallback(async () => {
        if (!online.map || !role || !myInventory || !online.isMyTurn || online.firing || localPlaybackActive) return
        const trimmed = expression.trim()
        const shot = simulateSharedFunctionWarsOnlineShot({
            expression: trimmed,
            role,
            weapon: selectedWeapon,
            map: online.map,
            crates: availableFunctionWarsCrates(online.crates, online.shotSeq),
            craters: online.craters,
            inventory: myInventory,
        })
        if (shot.error) {
            setInputError(shot.error)
            return
        }
        setInputError(null)
        setPreview(shot)
        setLocalPlaybackKey((current) => current + 1)
        setLocalPlaybackActive(true)
        const [result] = await Promise.all([
            online.fire(selectedWeapon, trimmed),
            new Promise<void>((resolve) => window.setTimeout(resolve, PLAYBACK_MS + 180)),
        ])
        if (result?.ok && result.shot_seq !== null) {
            const resultSeq = result.shot_seq
            setSeenShotSeq((current) => Math.max(current, resultSeq))
        }
        setLocalPlaybackActive(false)
    }, [expression, localPlaybackActive, myInventory, online, role, selectedWeapon])

    if (online.phase === "idle" || online.phase === "waiting" || online.phase === "creating" || online.phase === "joining" || online.phase === "error") {
        return <FunctionWarsOnlineLobby online={online} initialRoomCode={initialRoomCode} />
    }

    const opponent = role ? opponentFunctionWarsRole(role) : "guest"
    const statusText = online.phase === "finished"
        ? online.winner === "draw" ? "平局" : online.winner === role ? "任务完成" : "炮台失守"
        : online.isMyTurn ? "你的回合" : "对手计算中"

    return (
        <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
            <div className="min-w-0">
                <div className="mb-2 flex items-center gap-3 px-1">
                    <HpMeter label={role === "host" ? "我方 H" : "对手 H"} value={online.hp.host} active={online.currentTurn === "host"} side="host" />
                    <div className="grid min-w-20 shrink-0 place-items-center text-center" role="status" aria-live="polite" aria-atomic="true">
                        <span className={cn("text-[11px] font-black", online.isMyTurn ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>{statusText}</span>
                        {online.phase === "playing" ? (
                            <span className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10px] tabular-nums text-muted-foreground">
                                <Timer className="h-3 w-3" aria-hidden /> {secondsLeft}s
                            </span>
                        ) : null}
                    </div>
                    <HpMeter label={role === "guest" ? "我方 G" : "对手 G"} value={online.hp.guest} active={online.currentTurn === "guest"} side="guest" />
                </div>

                <div className="relative left-1/2 w-[100dvw] max-w-[100dvw] -translate-x-1/2 px-[max(12px,env(safe-area-inset-left))] md:static md:w-full md:max-w-none md:translate-x-0 md:px-0">
                    <div ref={containerRef} className="relative aspect-3/2 w-full overflow-hidden border border-foreground/20 bg-[#d8e2d5] shadow-[0_18px_48px_-34px_hsl(var(--surface-shadow)/0.65)]">
                        <canvas
                            ref={canvasRef}
                            className="block h-full w-full"
                            aria-label="函数战争在线战场"
                            aria-describedby={battlefieldDescriptionId}
                            role="img"
                        />
                        <p id={battlefieldDescriptionId} className="sr-only">
                            H 方炮台位于 x {online.map?.turrets.host.x ?? -10}、y {online.map?.turrets.host.y ?? -5.15}，生命值 {online.hp.host}/100。
                            G 方炮台位于 x {online.map?.turrets.guest.x ?? 10}、y {online.map?.turrets.guest.y ?? -5.15}，生命值 {online.hp.guest}/100。
                            当前轮到 {online.currentTurn === "host" ? "H 方" : "G 方"}，战场有 {online.map?.obstacles.length ?? 0} 个障碍和 {online.availableCrates.length} 个可拾取道具。
                            {online.lastShot
                                ? `上一发由 ${online.lastShot.by === "host" ? "H 方" : "G 方"} 发射函数 ${online.lastShot.expression}，造成 ${online.lastShot.damage?.applied ?? 0} 点伤害。`
                                : "尚未发射。"}
                        </p>
                        <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 bg-[#223236]/88 px-2 py-1 text-[10px] font-bold text-[#f1ebd6]">
                            <Radio className="h-3 w-3 text-[#f2bd3d]" aria-hidden />
                            SHOT {online.shotSeq.toString().padStart(2, "0")}
                        </div>
                        {replayIsActive && online.lastShot ? (
                            <div className="pointer-events-none absolute bottom-2 left-2 max-w-[75%] bg-[#f4ecd4]/92 px-2 py-1 font-mono text-[10px] font-bold text-[#263437] shadow-sm">
                                {online.lastShot.by === role ? "YOU" : "RIVAL"}: f(x)={online.lastShot.expression}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            <section className="min-w-0 max-w-full overflow-hidden border border-border/85 bg-[hsl(var(--surface-raised)/0.9)] p-3 sm:p-4" aria-label="在线炮术控制台">
                {myInventory ? (
                    <OnlineWeaponBar
                        inventory={myInventory}
                        selected={selectedWeapon}
                        onSelect={setSelectedWeapon}
                        disabled={!online.isMyTurn || online.firing || localPlaybackActive || online.phase === "finished"}
                    />
                ) : null}

                {myInventory && (myInventory.blast_boost || myInventory.penetration || myInventory.shield) ? (
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
                        {myInventory.blast_boost ? <span className="inline-flex items-center gap-1 bg-red-500/12 px-2 py-1 text-red-700 dark:text-red-300"><Zap className="h-3 w-3" />爆炸增幅</span> : null}
                        {myInventory.penetration ? <span className="inline-flex items-center gap-1 bg-amber-500/12 px-2 py-1 text-amber-800 dark:text-amber-200"><Drill className="h-3 w-3" />穿透强化</span> : null}
                        {myInventory.shield ? <span className="inline-flex items-center gap-1 bg-sky-500/12 px-2 py-1 text-sky-800 dark:text-sky-200"><Shield className="h-3 w-3" />护盾</span> : null}
                    </div>
                ) : null}

                <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_44px_44px] items-stretch gap-2 max-[359px]:grid-cols-[minmax(0,1fr)_44px]">
                    <div className="flex min-w-0 items-center border border-border bg-background focus-within:border-foreground/35 focus-within:ring-2 focus-within:ring-amber-500/25 max-[359px]:col-span-2">
                        <span className="pl-3 font-serif text-sm font-black text-muted-foreground" aria-hidden>f(x)=</span>
                        <input
                            value={expression}
                            onChange={(event) => {
                                setExpression(event.target.value)
                                setInputError(null)
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault()
                                    void handleFire()
                                }
                            }}
                            disabled={!online.isMyTurn || online.firing || localPlaybackActive || online.phase === "finished"}
                            spellCheck={false}
                            autoComplete="off"
                            inputMode="text"
                            className="h-11 min-w-0 flex-1 bg-transparent px-1.5 font-mono text-sm font-bold outline-none disabled:opacity-55"
                            aria-label="炮弹轨迹函数"
                        />
                    </div>
                    <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-11 w-11 shrink-0 rounded-sm"
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
                        className="h-11 w-11 shrink-0 rounded-sm bg-amber-500 text-[#282d2c] hover:bg-amber-400"
                        onClick={() => void handleFire()}
                        disabled={!online.isMyTurn || online.firing || localPlaybackActive || online.phase === "finished" || !expression.trim()}
                        aria-label="发射"
                        title="发射"
                    >
                        {online.firing || localPlaybackActive ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Send className="h-4 w-4" />}
                    </Button>
                </div>

                {inputError || online.error ? <p ref={errorRef} tabIndex={-1} className="mt-2 text-xs font-semibold text-destructive outline-none" role="alert">{inputError ?? online.error}</p> : null}

                <div className="mt-2 grid grid-cols-6 gap-1 sm:hidden" aria-label="数学快捷键盘">
                    {["x", "+", "−", "×", "÷", "^", "(", ")", "sin(", "cos(", "abs(", "sqrt("].map((token) => (
                        <button key={token} type="button" className="min-h-11 rounded-sm border border-border bg-background text-xs font-black active:scale-[0.97]" onClick={() => appendAtEnd(setExpression, token)}>{token}</button>
                    ))}
                    <button type="button" className="col-span-3 inline-flex min-h-11 items-center justify-center gap-1 rounded-sm border border-border bg-background text-xs font-bold text-muted-foreground" onClick={() => setExpression((value) => value.slice(0, -1))}><Delete className="h-3.5 w-3.5" />删除</button>
                    <button type="button" className="col-span-3 min-h-11 rounded-sm border border-border bg-background text-xs font-bold text-muted-foreground" onClick={() => setExpression("")}>清空</button>
                </div>

                {!online.isMyTurn && online.phase === "playing" ? <p className="mt-2 text-xs text-muted-foreground">对手回合，收到弹道后会自动回放。</p> : null}

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
                    {online.phase === "finished" ? (
                        <Button type="button" size="sm" className="min-h-11 gap-2 rounded-md" onClick={() => online.reset()}>
                            <RefreshCw className="h-4 w-4" />再开一局
                        </Button>
                    ) : null}
                    <Button type="button" variant="ghost" size="sm" className="min-h-11 gap-2 rounded-md text-muted-foreground" onClick={() => void online.leaveRoom()}>
                        <LogOut className="h-4 w-4" />{online.phase === "finished" ? "返回大厅" : "离开对局"}
                    </Button>
                    <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                        {online.isMyTurn ? <ChevronRight className="h-3 w-3 text-amber-600" /> : <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />}
                        {role ? `你是 ${role === "host" ? "H" : "G"}` : `对手 ${opponent}`}
                    </span>
                </div>
            </section>
        </div>
    )
}
