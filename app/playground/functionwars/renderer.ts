export const FUNCTION_WARS_WORLD_BOUNDS: Readonly<{
    minX: number
    maxX: number
    minY: number
    maxY: number
}> = {
    minX: -12,
    maxX: 12,
    minY: -7,
    maxY: 7,
} as const

export const FUNCTION_WARS_CANVAS_ASPECT_RATIO = 3 / 2

export type FunctionWarsPoint = {
    x: number
    y: number
}

export type FunctionWarsCanvasMetrics = {
    cssWidth: number
    cssHeight: number
    pixelWidth: number
    pixelHeight: number
    dpr: number
    scaleX: number
    scaleY: number
}

export type FunctionWarsRenderTheme = "grassland" | "meadow" | "canyon" | "space"

export type FunctionWarsRenderObstacle = {
    id: string
    shape: "rect" | "circle"
    x: number
    y: number
    width?: number
    height?: number
    radius?: number
    destructible: boolean
    material?: "earth" | "wood" | "rock" | "metal" | "steel" | "bedrock"
}

export type FunctionWarsRenderCrater = FunctionWarsPoint & {
    radius: number
}

export type FunctionWarsRenderUnit = FunctionWarsPoint & {
    id: string
    side: "player" | "enemy" | "host" | "guest"
    facing?: "left" | "right"
    hp?: number
    maxHp?: number
    armored?: boolean
    alive?: boolean
    shield?: boolean
    falling?: boolean
}

export type FunctionWarsRenderCrate = FunctionWarsPoint & {
    id: string
    type?: "ammo" | "blast_boost" | "penetration" | "shield" | "repair" | "relay"
    active?: boolean
}

export type FunctionWarsRenderTrace = {
    id: string
    points: FunctionWarsPoint[]
    color?: string
    mirrored?: boolean
    sourceUnitId?: string
}

export type FunctionWarsRenderImpact = FunctionWarsPoint & {
    id: string
    color?: string
    intensity?: number
    unitId?: string
    obstacleId?: string
}

export type FunctionWarsRenderScene = {
    theme: FunctionWarsRenderTheme
    obstacles: FunctionWarsRenderObstacle[]
    craters: FunctionWarsRenderCrater[]
    units: FunctionWarsRenderUnit[]
    crates: FunctionWarsRenderCrate[]
    traces: FunctionWarsRenderTrace[]
    ghostTraces?: FunctionWarsRenderTrace[]
    gridVisible?: boolean
    groundVisible?: boolean
    animationKey?: string | number | null
    animationDurationMs?: number
    impact?: FunctionWarsRenderImpact | null
    activeSide?: "player" | "enemy" | "host" | "guest" | null
}

type LoadedAsset = {
    image: HTMLImageElement
    ready: boolean
    failed: boolean
}

type Particle = FunctionWarsPoint & {
    vx: number
    vy: number
    gravity: number
    life: number
    maxLife: number
    size: number
    color: string
}

type PendingImpact = {
    impact: FunctionWarsRenderImpact
    dueAt: number
}

const DEFAULT_SCENE: FunctionWarsRenderScene = {
    theme: "grassland",
    obstacles: [],
    craters: [],
    units: [],
    crates: [],
    traces: [],
    ghostTraces: [],
    gridVisible: true,
    groundVisible: true,
    animationKey: null,
    impact: null,
    activeSide: null,
}

const THEME_ASSET_PATHS: Record<string, Record<string, string>> = {
    grassland: {
        sky: "/assets/playground-art/function-wars/grassland-sky.webp",
        far: "/assets/playground-art/function-wars/grassland-distant.webp",
    },
    canyon: {
        sky: "/assets/playground-art/function-wars/canyon-sky.webp",
        far: "/assets/playground-art/function-wars/canyon-distant.webp",
    },
    space: {
        sky: "/assets/playground-art/function-wars/space-sky.webp",
        far: "/assets/playground-art/function-wars/space-distant.webp",
    },
    units: {
        player: "/assets/playground-art/function-wars/player-turret.png",
        enemy: "/assets/playground-art/function-wars/enemy.png",
        armored: "/assets/playground-art/function-wars/enemy-armored.png",
        crate: "/assets/playground-art/function-wars/crate.png",
    },
}

function normalizedTheme(theme: FunctionWarsRenderTheme): "grassland" | "canyon" | "space" {
    return theme === "meadow" ? "grassland" : theme
}

function finitePositive(value: number, fallback: number): number {
    return Number.isFinite(value) && value > 0 ? value : fallback
}

export function getFunctionWarsCanvasMetrics(
    containerWidth: number,
    devicePixelRatio = 1,
): FunctionWarsCanvasMetrics {
    const cssWidth = Math.max(1, finitePositive(containerWidth, 1))
    const cssHeight = cssWidth / FUNCTION_WARS_CANVAS_ASPECT_RATIO
    const dpr = Math.min(3, finitePositive(devicePixelRatio, 1))
    const worldWidth = FUNCTION_WARS_WORLD_BOUNDS.maxX - FUNCTION_WARS_WORLD_BOUNDS.minX
    const worldHeight = FUNCTION_WARS_WORLD_BOUNDS.maxY - FUNCTION_WARS_WORLD_BOUNDS.minY

    return {
        cssWidth,
        cssHeight,
        pixelWidth: Math.max(1, Math.round(cssWidth * dpr)),
        pixelHeight: Math.max(1, Math.round(cssHeight * dpr)),
        dpr,
        scaleX: cssWidth / worldWidth,
        scaleY: cssHeight / worldHeight,
    }
}

export function worldToCanvas(
    point: FunctionWarsPoint,
    metrics: Pick<FunctionWarsCanvasMetrics, "cssWidth" | "cssHeight">,
): FunctionWarsPoint {
    const { minX, maxX, minY, maxY } = FUNCTION_WARS_WORLD_BOUNDS
    return {
        x: ((point.x - minX) / (maxX - minX)) * metrics.cssWidth,
        y: ((maxY - point.y) / (maxY - minY)) * metrics.cssHeight,
    }
}

export function canvasToWorld(
    point: FunctionWarsPoint,
    metrics: Pick<FunctionWarsCanvasMetrics, "cssWidth" | "cssHeight">,
): FunctionWarsPoint {
    const { minX, maxX, minY, maxY } = FUNCTION_WARS_WORLD_BOUNDS
    return {
        x: minX + (point.x / metrics.cssWidth) * (maxX - minX),
        y: maxY - (point.y / metrics.cssHeight) * (maxY - minY),
    }
}

export function getFunctionWarsRoundedRectRadius(
    width: number,
    height: number,
    radius: number,
): number | null {
    if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0
    ) return null
    return Math.max(0, Math.min(Math.abs(radius), width / 2, height / 2))
}

function roundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
) {
    ctx.beginPath()
    if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(width) ||
        !Number.isFinite(height)
    ) return
    const r = getFunctionWarsRoundedRectRadius(width, height, radius)
    if (r === null) return
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + width, y, x + width, y + height, r)
    ctx.arcTo(x + width, y + height, x, y + height, r)
    ctx.arcTo(x, y + height, x, y, r)
    ctx.arcTo(x, y, x + width, y, r)
    ctx.closePath()
}

export type FunctionWarsCoverRect = {
    x: number
    y: number
    width: number
    height: number
}

export type FunctionWarsBackgroundMotion = {
    sky: FunctionWarsPoint
    far: FunctionWarsPoint
}

type CoverImageOptions = {
    offsetX?: number
    offsetY?: number
    overscan?: number
}

export function getFunctionWarsCoverRect(
    sourceWidth: number,
    sourceHeight: number,
    targetWidth: number,
    targetHeight: number,
    options: CoverImageOptions = {},
): FunctionWarsCoverRect {
    const width = finitePositive(targetWidth, 1)
    const height = finitePositive(targetHeight, 1)
    const overscan = Number.isFinite(options.overscan)
        ? Math.max(0, options.overscan ?? 0)
        : 0
    const offsetX = Number.isFinite(options.offsetX) ? options.offsetX ?? 0 : 0
    const offsetY = Number.isFinite(options.offsetY) ? options.offsetY ?? 0 : 0
    const paddedWidth = width + overscan * 2
    const paddedHeight = height + overscan * 2
    const sourceRatio = finitePositive(sourceWidth, 1) / finitePositive(sourceHeight, 1)
    const targetRatio = paddedWidth / paddedHeight
    let drawWidth = paddedWidth
    let drawHeight = paddedHeight
    if (sourceRatio > targetRatio) {
        drawWidth = paddedHeight * sourceRatio
    } else {
        drawHeight = paddedWidth / sourceRatio
    }

    return {
        x: (width - drawWidth) / 2 + offsetX,
        y: (height - drawHeight) / 2 + offsetY,
        width: drawWidth,
        height: drawHeight,
    }
}

export function getFunctionWarsBackgroundMotion(
    theme: FunctionWarsRenderTheme,
    width: number,
    height: number,
    now: number,
): FunctionWarsBackgroundMotion {
    const motionNow = Number.isFinite(now) ? Math.max(0, now) : 0
    if (motionNow === 0) {
        return {
            sky: { x: 0, y: 0 },
            far: { x: 0, y: 0 },
        }
    }

    const safeWidth = finitePositive(width, 1)
    const safeHeight = finitePositive(height, 1)
    const themeKey = normalizedTheme(theme)
    const farAmplitude = themeKey === "grassland"
        ? { x: 0.01, y: 0.003 }
        : themeKey === "canyon"
            ? { x: 0.007, y: 0.0025 }
            : { x: 0.004, y: 0.0035 }
    const farPeriod = themeKey === "grassland"
        ? { x: 16_000, y: 21_000 }
        : themeKey === "canyon"
            ? { x: 19_000, y: 23_000 }
            : { x: 24_000, y: 20_000 }

    return {
        sky: {
            x: Math.sin(motionNow / 28_000) * safeWidth * 0.002,
            y: Math.sin(motionNow / 32_000) * safeHeight * 0.0015,
        },
        far: {
            x: Math.sin(motionNow / farPeriod.x) * safeWidth * farAmplitude.x,
            y: Math.sin(motionNow / farPeriod.y) * safeHeight * farAmplitude.y,
        },
    }
}

export function getFunctionWarsUnitVisualDrop(
    unit: Pick<FunctionWarsRenderUnit, "x" | "y">,
    obstacles: readonly FunctionWarsRenderObstacle[],
    metrics: Pick<FunctionWarsCanvasMetrics, "cssWidth" | "cssHeight">,
    spriteHeight: number,
): number {
    let nearestSupportTop: number | null = null
    for (const obstacle of obstacles) {
        if (obstacle.shape !== "rect") continue
        const obstacleWidth = obstacle.width ?? 0
        const obstacleHeight = obstacle.height ?? 0
        if (obstacleWidth <= 0 || obstacleHeight <= 0) continue
        if (Math.abs(unit.x - obstacle.x) > obstacleWidth / 2 + 0.05) continue

        const supportTop = obstacle.y + obstacleHeight / 2
        const verticalGap = unit.y - supportTop
        if (verticalGap < 0 || verticalGap > 1.25) continue
        if (nearestSupportTop === null || supportTop > nearestSupportTop) {
            nearestSupportTop = supportTop
        }
    }
    if (nearestSupportTop === null) return 0

    const unitPoint = worldToCanvas(unit, metrics)
    const supportPoint = worldToCanvas({ x: unit.x, y: nearestSupportTop }, metrics)
    const artContactOffset = Math.max(0, spriteHeight) * 0.11
    return Math.max(0, supportPoint.y - unitPoint.y - artContactOffset)
}

function coverImage(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    width: number,
    height: number,
    options: CoverImageOptions = {},
) {
    const rect = getFunctionWarsCoverRect(
        image.naturalWidth,
        image.naturalHeight,
        width,
        height,
        options,
    )
    ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height)
}

function hashSceneGeometry(scene: FunctionWarsRenderScene, metrics: FunctionWarsCanvasMetrics): string {
    const obstacleKey = scene.obstacles
        .filter((obstacle) => obstacle.destructible)
        .map((obstacle) => `${obstacle.id}:${obstacle.x}:${obstacle.y}:${obstacle.width}:${obstacle.height}:${obstacle.radius}`)
        .join("|")
    const craterKey = scene.craters.map((crater) => `${crater.x}:${crater.y}:${crater.radius}`).join("|")
    return `${normalizedTheme(scene.theme)}:${scene.groundVisible !== false ? "ground" : "void"}:${Math.round(metrics.cssWidth)}:${Math.round(metrics.cssHeight)}:${obstacleKey}:${craterKey}`
}

export class FunctionWarsRenderer {
    private readonly canvas: HTMLCanvasElement
    private readonly ctx: CanvasRenderingContext2D
    private readonly terrainCanvas: HTMLCanvasElement
    private readonly terrainCtx: CanvasRenderingContext2D
    private metrics: FunctionWarsCanvasMetrics
    private scene: FunctionWarsRenderScene = DEFAULT_SCENE
    private frameId: number | null = null
    private wakeTimerId: number | null = null
    private running = false
    private destroyed = false
    private intersecting = true
    private lastFrameAt = 0
    private terrainKey = ""
    private animationKey: string | number | null = null
    private animationStartedAt = 0
    private seenImpactId: string | null = null
    private pendingImpact: PendingImpact | null = null
    private obstacleImpact: { obstacleId: string; startedAt: number } | null = null
    private particles: Particle[] = []
    private shake = 0
    private flash = 0
    private assets = new Map<string, LoadedAsset>()
    private destroyedUnits = new Map<string, number>()
    private pendingDestroyedUnits = new Map<string, number>()
    private pendingUnitSnapshots = new Map<string, FunctionWarsRenderUnit>()
    private deferredCraters: FunctionWarsRenderCrater[] | null = null
    private previousAliveUnits = new Set<string>()
    private reduceMotion = false
    private readonly motionQuery: MediaQueryList | null
    private readonly intersectionObserver: IntersectionObserver | null

    constructor(canvas: HTMLCanvasElement) {
        const ctx = canvas.getContext("2d")
        if (!ctx) throw new Error("Canvas 2D context is unavailable")
        this.canvas = canvas
        this.ctx = ctx
        this.terrainCanvas = document.createElement("canvas")
        const terrainCtx = this.terrainCanvas.getContext("2d")
        if (!terrainCtx) throw new Error("Offscreen Canvas 2D context is unavailable")
        this.terrainCtx = terrainCtx
        this.metrics = getFunctionWarsCanvasMetrics(1)
        this.motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null
        this.reduceMotion = this.motionQuery?.matches ?? false
        this.motionQuery?.addEventListener?.("change", this.handleMotionPreferenceChange)
        document.addEventListener("visibilitychange", this.handleVisibilityChange)
        this.intersectionObserver = typeof IntersectionObserver === "undefined"
            ? null
            : new IntersectionObserver((entries) => {
                const entry = entries[0]
                if (!entry) return
                this.intersecting = entry.isIntersecting
                this.syncAnimationLoop()
            })
        this.intersectionObserver?.observe(canvas)
    }

    resize(containerWidth: number, devicePixelRatio = window.devicePixelRatio || 1) {
        if (this.destroyed) return
        const metrics = getFunctionWarsCanvasMetrics(containerWidth, devicePixelRatio)
        this.metrics = metrics
        this.canvas.width = metrics.pixelWidth
        this.canvas.height = metrics.pixelHeight
        this.canvas.style.width = `${metrics.cssWidth}px`
        this.canvas.style.height = `${metrics.cssHeight}px`
        this.ctx.setTransform(1, 0, 0, 1, 0, 0)
        this.ctx.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0)

        this.terrainCanvas.width = metrics.pixelWidth
        this.terrainCanvas.height = metrics.pixelHeight
        this.terrainCtx.setTransform(1, 0, 0, 1, 0, 0)
        this.terrainCtx.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0)
        this.terrainKey = ""
        this.draw(performance.now())
    }

    setScene(scene: FunctionWarsRenderScene) {
        if (this.destroyed) return
        const now = performance.now()
        const previousUnits = new Map(this.scene.units.map((unit) => [unit.id, unit]))
        const previousCraters = this.scene.craters
        this.scene = {
            ...DEFAULT_SCENE,
            ...scene,
            ghostTraces: scene.ghostTraces ?? [],
        }
        this.loadThemeAssets(scene.theme)
        this.loadSceneAssets(this.scene)

        const nextAnimationKey = scene.animationKey ?? null
        if (nextAnimationKey === null) {
            this.animationKey = null
            this.animationStartedAt = 0
        } else if (nextAnimationKey !== this.animationKey) {
            this.animationKey = nextAnimationKey
            this.animationStartedAt = now
        }
        const effectDueAt = this.animationKey !== null && scene.traces.length > 0 && !this.reduceMotion
            ? this.animationStartedAt + this.animationDurationMs()
            : now
        if (effectDueAt > now && scene.impact && scene.impact.id !== this.seenImpactId) {
            this.deferredCraters = previousCraters.map((crater) => ({ ...crater }))
            this.terrainKey = ""
        } else if (effectDueAt <= now || !scene.impact) {
            this.deferredCraters = null
        }

        if (!scene.impact) {
            this.seenImpactId = null
            this.pendingImpact = null
            this.obstacleImpact = null
        } else if (scene.impact.id !== this.seenImpactId) {
            this.seenImpactId = scene.impact.id
            this.pendingImpact = { impact: scene.impact, dueAt: effectDueAt }
        }

        const aliveUnits = new Set(
            scene.units.filter((unit) => unit.alive !== false).map((unit) => unit.id),
        )
        const sceneUnitIds = new Set(scene.units.map((unit) => unit.id))
        for (const id of this.pendingDestroyedUnits.keys()) {
            if (!sceneUnitIds.has(id)) {
                this.pendingDestroyedUnits.delete(id)
                this.pendingUnitSnapshots.delete(id)
            }
        }
        for (const id of this.destroyedUnits.keys()) {
            if (!sceneUnitIds.has(id)) this.destroyedUnits.delete(id)
        }
        for (const id of aliveUnits) {
            this.pendingDestroyedUnits.delete(id)
            this.pendingUnitSnapshots.delete(id)
            this.destroyedUnits.delete(id)
        }
        for (const id of this.previousAliveUnits) {
            if (!aliveUnits.has(id) && sceneUnitIds.has(id)) {
                this.pendingDestroyedUnits.set(id, effectDueAt)
                const snapshot = previousUnits.get(id)
                if (snapshot) this.pendingUnitSnapshots.set(id, { ...snapshot })
            }
        }
        if (scene.impact?.unitId && !aliveUnits.has(scene.impact.unitId)) {
            this.pendingDestroyedUnits.set(scene.impact.unitId, effectDueAt)
        }
        this.previousAliveUnits = aliveUnits
        this.flushPendingEffects(now)
        this.draw(now)
        this.syncAnimationLoop()
    }

    start() {
        if (this.destroyed || this.running) return
        this.running = true
        this.lastFrameAt = performance.now()
        this.syncAnimationLoop()
    }

    stop() {
        this.running = false
        this.cancelScheduledFrame()
    }

    destroy() {
        if (this.destroyed) return
        this.stop()
        this.destroyed = true
        document.removeEventListener("visibilitychange", this.handleVisibilityChange)
        this.motionQuery?.removeEventListener?.("change", this.handleMotionPreferenceChange)
        this.intersectionObserver?.disconnect()
        for (const asset of this.assets.values()) {
            asset.image.onload = null
            asset.image.onerror = null
        }
        this.assets.clear()
        this.particles = []
        this.pendingImpact = null
        this.pendingDestroyedUnits.clear()
        this.pendingUnitSnapshots.clear()
        this.destroyedUnits.clear()
        this.deferredCraters = null
    }

    triggerExplosion(impact: FunctionWarsRenderImpact) {
        if (this.destroyed) return
        const now = performance.now()
        if (impact.obstacleId && !this.reduceMotion) {
            this.obstacleImpact = { obstacleId: impact.obstacleId, startedAt: now }
        }
        if (this.reduceMotion) {
            this.particles = []
            this.shake = 0
            this.flash = 0
            return
        }
        const colors = impact.color
            ? [impact.color, "#fff0ac", "#e84b32"]
            : ["#f5b83d", "#fff0ac", "#e84b32", "#4a3932"]
        const count = Math.max(14, Math.round(impact.intensity ?? 28))
        for (let index = 0; index < count; index += 1) {
            const angle = (Math.PI * 2 * index) / count + Math.random() * 0.32
            const speed = 2.2 + Math.random() * 6.2
            this.particles.push({
                x: impact.x,
                y: impact.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed + 1.6,
                gravity: -9.5,
                life: 0.45 + Math.random() * 0.55,
                maxLife: 1,
                size: 2 + Math.random() * 4.5,
                color: colors[index % colors.length],
            })
        }
        this.shake = Math.min(12, 5 + count / 8)
        this.flash = 0.28
        this.syncAnimationLoop()
    }

    private animationDurationMs(): number {
        return Math.max(240, this.scene.animationDurationMs ?? 1200)
    }

    private destroyedUnitAnimationMs(unitId: string): number {
        return this.scene.units.find((unit) => unit.id === unitId)?.falling ? 760 : 360
    }

    private canRunAnimationLoop(): boolean {
        return (
            this.running &&
            !this.destroyed &&
            !this.reduceMotion &&
            this.intersecting &&
            document.visibilityState !== "hidden"
        )
    }

    private cancelScheduledFrame() {
        if (this.frameId !== null) {
            cancelAnimationFrame(this.frameId)
            this.frameId = null
        }
        if (this.wakeTimerId !== null) {
            window.clearTimeout(this.wakeTimerId)
            this.wakeTimerId = null
        }
    }

    private syncAnimationLoop() {
        if (!this.canRunAnimationLoop()) {
            this.cancelScheduledFrame()
            return
        }
        if (this.frameId !== null) return

        const now = performance.now()
        const active = this.hasActiveAnimation(now)
        if (this.wakeTimerId !== null) {
            if (!active) return
            window.clearTimeout(this.wakeTimerId)
            this.wakeTimerId = null
        }
        const delay = active ? 0 : 50
        if (delay > 0) {
            this.wakeTimerId = window.setTimeout(() => {
                this.wakeTimerId = null
                if (!this.canRunAnimationLoop()) return
                this.frameId = requestAnimationFrame(this.tick)
            }, delay)
            return
        }
        this.frameId = requestAnimationFrame(this.tick)
    }

    private readonly tick = (now: number) => {
        this.frameId = null
        if (!this.canRunAnimationLoop()) return
        const delta = Math.min(0.05, Math.max(0, (now - this.lastFrameAt) / 1000))
        this.lastFrameAt = now
        this.updateEffects(delta)
        this.draw(now)
        this.syncAnimationLoop()
    }

    private hasActiveAnimation(now: number): boolean {
        if (
            this.particles.length > 0 ||
            this.shake > 0 ||
            this.flash > 0 ||
            this.pendingImpact !== null ||
            this.pendingDestroyedUnits.size > 0
        ) {
            return true
        }
        if (
            this.animationKey !== null &&
            this.scene.traces.length > 0 &&
            now < this.animationStartedAt + this.animationDurationMs()
        ) {
            return true
        }
        for (const [unitId, startedAt] of this.destroyedUnits) {
            if (now - startedAt < this.destroyedUnitAnimationMs(unitId)) return true
        }
        return Boolean(this.obstacleImpact && now - this.obstacleImpact.startedAt < 260)
    }

    private flushPendingEffects(now: number) {
        if (this.pendingImpact && now >= this.pendingImpact.dueAt) {
            const { impact } = this.pendingImpact
            this.pendingImpact = null
            this.triggerExplosion(impact)
            if (impact.unitId) {
                this.pendingDestroyedUnits.delete(impact.unitId)
                this.pendingUnitSnapshots.delete(impact.unitId)
                if (!this.reduceMotion) this.destroyedUnits.set(impact.unitId, now)
            }
            this.deferredCraters = null
            this.terrainKey = ""
        }

        for (const [id, dueAt] of this.pendingDestroyedUnits) {
            if (now < dueAt) continue
            this.pendingDestroyedUnits.delete(id)
            this.pendingUnitSnapshots.delete(id)
            if (!this.reduceMotion && !this.destroyedUnits.has(id)) {
                this.destroyedUnits.set(id, now)
            }
        }
    }

    private readonly handleVisibilityChange = () => {
        if (document.visibilityState !== "hidden") this.lastFrameAt = performance.now()
        this.syncAnimationLoop()
    }

    private readonly handleMotionPreferenceChange = (event: MediaQueryListEvent) => {
        this.reduceMotion = event.matches
        const now = performance.now()
        if (this.reduceMotion) {
            this.particles = []
            this.shake = 0
            this.flash = 0
            this.obstacleImpact = null
            this.destroyedUnits.clear()
            if (this.pendingImpact) this.pendingImpact.dueAt = now
            for (const id of this.pendingDestroyedUnits.keys()) {
                this.pendingDestroyedUnits.set(id, now)
            }
            this.flushPendingEffects(now)
        }
        this.lastFrameAt = now
        this.draw(now)
        this.syncAnimationLoop()
    }

    private loadSceneAssets(scene: FunctionWarsRenderScene) {
        const keys = new Set<string>()
        for (const unit of scene.units) {
            if (unit.side === "player" || unit.side === "host" || unit.side === "guest") {
                keys.add("player")
            } else {
                keys.add(unit.armored ? "armored" : "enemy")
            }
        }
        if (scene.crates.some((crate) => crate.active !== false && crate.type !== "relay")) keys.add("crate")
        for (const key of keys) {
            this.loadAsset(`unit:${key}`, THEME_ASSET_PATHS.units[key])
        }
    }

    private loadThemeAssets(theme: FunctionWarsRenderTheme) {
        const themeKey = normalizedTheme(theme)
        const themeAssets = THEME_ASSET_PATHS[themeKey]
        for (const [name, path] of Object.entries(themeAssets)) {
            this.loadAsset(`${themeKey}:${name}`, path)
        }
    }

    private loadAsset(key: string, path: string) {
        if (this.destroyed || this.assets.has(key)) return
        const image = new Image()
        const record: LoadedAsset = { image, ready: false, failed: false }
        this.assets.set(key, record)
        image.onload = () => {
            if (this.destroyed) return
            record.ready = true
            this.draw(performance.now())
        }
        image.onerror = () => {
            if (this.destroyed) return
            record.failed = true
        }
        image.src = path
    }

    private asset(key: string): HTMLImageElement | null {
        const asset = this.assets.get(key)
        return asset?.ready && !asset.failed ? asset.image : null
    }

    private updateEffects(delta: number) {
        for (const particle of this.particles) {
            particle.x += particle.vx * delta
            particle.y += particle.vy * delta
            particle.vy += particle.gravity * delta
            particle.life -= delta
        }
        this.particles = this.particles.filter((particle) => particle.life > 0)
        this.shake = Math.max(0, this.shake - delta * 28)
        this.flash = Math.max(0, this.flash - delta * 1.9)
    }

    private draw(now: number) {
        if (this.destroyed) return
        this.flushPendingEffects(now)
        const { cssWidth: width, cssHeight: height } = this.metrics
        if (width <= 1 || height <= 1) return
        const motionNow = this.reduceMotion ? 0 : now

        const ctx = this.ctx
        ctx.save()
        ctx.clearRect(0, 0, width, height)
        if (this.shake > 0) {
            ctx.translate(
                (Math.random() - 0.5) * this.shake,
                (Math.random() - 0.5) * this.shake * 0.65,
            )
        }

        this.drawBackground(ctx, motionNow)
        if (this.scene.gridVisible) this.drawCoordinateGrid(ctx)
        this.rebuildTerrainIfNeeded()
        ctx.drawImage(this.terrainCanvas, 0, 0, width, height)
        this.drawSolidObstacles(ctx, now)
        this.drawCrates(ctx, motionNow)
        this.drawGhostTraces(ctx)
        this.drawUnits(ctx, now)
        this.drawActiveTraces(ctx, now)
        this.drawParticles(ctx)
        this.drawVignette(ctx)
        ctx.restore()

        if (this.flash > 0) {
            ctx.save()
            ctx.fillStyle = `rgba(255, 245, 207, ${this.flash})`
            ctx.fillRect(0, 0, width, height)
            ctx.restore()
        }
    }

    private drawBackground(ctx: CanvasRenderingContext2D, now: number) {
        const { cssWidth: width, cssHeight: height } = this.metrics
        const theme = normalizedTheme(this.scene.theme)
        const motion = getFunctionWarsBackgroundMotion(theme, width, height, now)
        const overscan = Math.max(width, height) * 0.028
        const skyImage = this.asset(`${theme}:sky`)
        if (skyImage) {
            coverImage(ctx, skyImage, width, height, {
                offsetX: motion.sky.x,
                offsetY: motion.sky.y,
                overscan,
            })
        } else {
            this.drawProceduralSky(ctx, theme, now)
        }

        const farImage = this.asset(`${theme}:far`)
        if (farImage) {
            ctx.save()
            ctx.globalAlpha = 0.96
            coverImage(ctx, farImage, width, height, {
                offsetX: motion.far.x,
                offsetY: motion.far.y,
                overscan,
            })
            ctx.restore()
        } else {
            this.drawProceduralFarLayer(ctx, theme, now)
        }

        if (skyImage || farImage) this.drawThemeAmbience(ctx, theme, now)
    }

    private drawThemeAmbience(
        ctx: CanvasRenderingContext2D,
        theme: "grassland" | "canyon" | "space",
        now: number,
    ) {
        const { cssWidth: width, cssHeight: height } = this.metrics
        if (theme === "space") {
            const starCount = width < 500 ? 18 : 28
            ctx.save()
            for (let index = 0; index < starCount; index += 1) {
                const x = ((index * 149 + 37) % 997) / 997 * width
                const y = ((index * 83 + 19) % 421) / 421 * height * 0.68
                const pulse = 0.2 + Math.sin(now / (760 + index % 5 * 120) + index * 1.7) * 0.14
                const radius = index % 8 === 0 ? 1.45 : 0.7
                ctx.fillStyle = `rgba(224, 243, 226, ${pulse})`
                ctx.beginPath()
                ctx.arc(x, y, radius, 0, Math.PI * 2)
                ctx.fill()

                if (index % 9 === 0) {
                    ctx.strokeStyle = `rgba(146, 217, 206, ${pulse * 0.72})`
                    ctx.lineWidth = 0.7
                    ctx.beginPath()
                    ctx.moveTo(x - 3.5, y)
                    ctx.lineTo(x + 3.5, y)
                    ctx.moveTo(x, y - 3.5)
                    ctx.lineTo(x, y + 3.5)
                    ctx.stroke()
                }
            }
            ctx.restore()
            return
        }

        if (theme === "canyon") {
            const span = width + 180
            ctx.save()
            ctx.lineCap = "round"
            for (let index = 0; index < 3; index += 1) {
                const x = ((now * (0.0028 + index * 0.0005) + index * span * 0.37) % span) - 90
                const y = height * (0.31 + index * 0.065)
                ctx.strokeStyle = `rgba(246, 213, 163, ${0.1 - index * 0.018})`
                ctx.lineWidth = 2.5 + index * 1.5
                ctx.beginPath()
                ctx.moveTo(x - 55, y)
                ctx.bezierCurveTo(x - 16, y - 7, x + 22, y + 6, x + 72, y - 2)
                ctx.stroke()
            }
            for (let index = 0; index < 9; index += 1) {
                const x = ((now * (0.004 + index % 3 * 0.0007) + index * 97) % (width + 70)) - 35
                const y = height * (0.24 + ((index * 41) % 100) / 500)
                const alpha = 0.08 + Math.sin(now / 1_800 + index) * 0.025
                ctx.fillStyle = `rgba(255, 225, 179, ${alpha})`
                ctx.beginPath()
                ctx.arc(x, y, 0.8 + index % 3 * 0.45, 0, Math.PI * 2)
                ctx.fill()
            }
            ctx.restore()
            return
        }

        const cloudCount = width < 500 ? 2 : 3
        const span = width + 220
        ctx.save()
        ctx.fillStyle = "rgba(246, 251, 232, 0.16)"
        for (let index = 0; index < cloudCount; index += 1) {
            const x = ((now * (0.0045 + index * 0.0008) + index * span * 0.39) % span) - 110
            const y = height * (0.1 + index * 0.085) + Math.sin(now / 6_000 + index) * 1.5
            const size = width < 500 ? 0.72 : 1
            ctx.beginPath()
            ctx.ellipse(x, y, 48 * size, 9 * size, -0.04, 0, Math.PI * 2)
            ctx.ellipse(x + 29 * size, y - 4 * size, 28 * size, 11 * size, 0.02, 0, Math.PI * 2)
            ctx.ellipse(x - 31 * size, y + 2 * size, 24 * size, 7 * size, 0, 0, Math.PI * 2)
            ctx.fill()
        }
        ctx.restore()
    }

    private drawProceduralSky(
        ctx: CanvasRenderingContext2D,
        theme: "grassland" | "canyon" | "space",
        now: number,
    ) {
        const { cssWidth: width, cssHeight: height } = this.metrics
        const gradient = ctx.createLinearGradient(0, 0, 0, height)
        if (theme === "space") {
            gradient.addColorStop(0, "#10142d")
            gradient.addColorStop(0.65, "#24314d")
            gradient.addColorStop(1, "#536575")
        } else if (theme === "canyon") {
            gradient.addColorStop(0, "#79c5d9")
            gradient.addColorStop(0.62, "#d8e6cf")
            gradient.addColorStop(1, "#f3c58b")
        } else {
            gradient.addColorStop(0, "#75c9dc")
            gradient.addColorStop(0.7, "#d6ead5")
            gradient.addColorStop(1, "#f2e8b8")
        }
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, width, height)

        if (theme === "space") {
            for (let index = 0; index < 72; index += 1) {
                const x = ((index * 83) % 997) / 997 * width
                const y = ((index * 47) % 421) / 421 * height * 0.7
                const alpha = 0.35 + Math.sin(now / 950 + index) * 0.18
                ctx.fillStyle = `rgba(235, 244, 226, ${alpha})`
                ctx.beginPath()
                ctx.arc(x, y, index % 9 === 0 ? 1.5 : 0.7, 0, Math.PI * 2)
                ctx.fill()
            }
            ctx.fillStyle = "rgba(195, 225, 207, 0.72)"
            ctx.beginPath()
            ctx.arc(width * 0.82, height * 0.16, height * 0.13, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = "rgba(66, 89, 106, 0.2)"
            ctx.beginPath()
            ctx.ellipse(width * 0.81, height * 0.17, height * 0.17, height * 0.035, -0.18, 0, Math.PI * 2)
            ctx.fill()
            return
        }

        const sunX = theme === "canyon" ? width * 0.2 : width * 0.82
        ctx.fillStyle = theme === "canyon" ? "rgba(247, 202, 118, 0.78)" : "rgba(255, 235, 151, 0.82)"
        ctx.beginPath()
        ctx.arc(sunX, height * 0.16, height * 0.08, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = "rgba(246, 250, 232, 0.72)"
        for (let index = 0; index < 4; index += 1) {
            const drift = ((now / 170 + index * 230) % (width + 180)) - 90
            const y = height * (0.12 + index * 0.085)
            ctx.beginPath()
            ctx.ellipse(drift, y, 46, 13, 0, 0, Math.PI * 2)
            ctx.ellipse(drift + 32, y - 6, 29, 17, 0, 0, Math.PI * 2)
            ctx.ellipse(drift - 28, y + 2, 25, 11, 0, 0, Math.PI * 2)
            ctx.fill()
        }
    }

    private drawProceduralFarLayer(
        ctx: CanvasRenderingContext2D,
        theme: "grassland" | "canyon" | "space",
        now: number,
    ) {
        const { cssWidth: width, cssHeight: height } = this.metrics
        if (theme === "space") {
            const baseline = height * 0.55
            ctx.fillStyle = "rgba(40, 56, 72, 0.76)"
            for (let index = 0; index < 7; index += 1) {
                const x = width * (index / 6) - 24
                const moduleHeight = height * (0.09 + (index % 3) * 0.028)
                roundedRect(ctx, x, baseline - moduleHeight, width * 0.13, moduleHeight, 7)
                ctx.fill()
                ctx.fillStyle = "rgba(190, 214, 207, 0.35)"
                ctx.fillRect(x + 8, baseline - moduleHeight + 10, width * 0.07, 4)
                ctx.fillStyle = "rgba(40, 56, 72, 0.76)"
            }
            ctx.strokeStyle = "rgba(169, 195, 191, 0.45)"
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(0, baseline)
            for (let x = 0; x <= width; x += 24) {
                ctx.lineTo(x, baseline - 5 - Math.sin(x * 0.04 + now / 5000) * 2)
            }
            ctx.stroke()
            return
        }

        if (theme === "canyon") {
            ctx.fillStyle = "rgba(150, 102, 72, 0.48)"
            ctx.beginPath()
            ctx.moveTo(0, height * 0.48)
            for (let x = 0; x <= width + 80; x += 70) {
                const step = Math.floor(x / 70)
                const top = height * (0.39 + (step % 3) * 0.035)
                ctx.lineTo(x, top)
                ctx.lineTo(x + 38, top)
                ctx.lineTo(x + 58, height * 0.51)
            }
            ctx.lineTo(width, height)
            ctx.lineTo(0, height)
            ctx.closePath()
            ctx.fill()
            return
        }

        ctx.fillStyle = "rgba(50, 112, 91, 0.28)"
        ctx.beginPath()
        ctx.moveTo(0, height * 0.52)
        for (let x = 0; x <= width; x += 18) {
            ctx.lineTo(x, height * (0.5 - Math.sin(x * 0.018) * 0.055))
        }
        ctx.lineTo(width, height)
        ctx.lineTo(0, height)
        ctx.closePath()
        ctx.fill()

        ctx.strokeStyle = "rgba(57, 92, 75, 0.45)"
        ctx.lineWidth = 2
        for (let index = 0; index < 4; index += 1) {
            const x = width * (0.18 + index * 0.22)
            const y = height * 0.48
            ctx.beginPath()
            ctx.moveTo(x, y)
            ctx.lineTo(x, y - 34)
            ctx.stroke()
            ctx.save()
            ctx.translate(x, y - 34)
            ctx.rotate(now / 9000 + index)
            for (let blade = 0; blade < 3; blade += 1) {
                ctx.rotate((Math.PI * 2) / 3)
                ctx.beginPath()
                ctx.moveTo(0, 0)
                ctx.lineTo(3, -21)
                ctx.lineTo(-2, -24)
                ctx.closePath()
                ctx.fillStyle = "rgba(235, 238, 211, 0.62)"
                ctx.fill()
            }
            ctx.restore()
        }
    }

    private drawCoordinateGrid(ctx: CanvasRenderingContext2D) {
        const { cssWidth: width, cssHeight: height } = this.metrics
        ctx.save()
        ctx.lineWidth = 1
        ctx.font = "600 9px ui-sans-serif, system-ui, sans-serif"
        ctx.textAlign = "center"
        ctx.textBaseline = "top"

        for (let x = FUNCTION_WARS_WORLD_BOUNDS.minX; x <= FUNCTION_WARS_WORLD_BOUNDS.maxX; x += 1) {
            const point = worldToCanvas({ x, y: 0 }, this.metrics)
            const major = x === 0
            ctx.strokeStyle = major ? "rgba(34, 53, 58, 0.5)" : "rgba(34, 53, 58, 0.13)"
            ctx.lineWidth = major ? 1.4 : 1
            ctx.beginPath()
            ctx.moveTo(point.x, 0)
            ctx.lineTo(point.x, height)
            ctx.stroke()
            if (x !== 0 && x % 2 === 0) {
                ctx.fillStyle = "rgba(26, 45, 51, 0.64)"
                ctx.fillText(String(x), point.x, Math.min(height - 13, point.y + 4))
            }
        }

        for (let y = FUNCTION_WARS_WORLD_BOUNDS.minY; y <= FUNCTION_WARS_WORLD_BOUNDS.maxY; y += 1) {
            const point = worldToCanvas({ x: 0, y }, this.metrics)
            const major = y === 0
            ctx.strokeStyle = major ? "rgba(34, 53, 58, 0.5)" : "rgba(34, 53, 58, 0.13)"
            ctx.lineWidth = major ? 1.4 : 1
            ctx.beginPath()
            ctx.moveTo(0, point.y)
            ctx.lineTo(width, point.y)
            ctx.stroke()
            if (y !== 0 && y % 2 === 0) {
                ctx.fillStyle = "rgba(26, 45, 51, 0.64)"
                ctx.textAlign = "left"
                ctx.textBaseline = "middle"
                ctx.fillText(String(y), Math.min(width - 16, point.x + 4), point.y)
                ctx.textAlign = "center"
                ctx.textBaseline = "top"
            }
        }
        ctx.restore()
    }

    private rebuildTerrainIfNeeded() {
        const terrainScene = this.deferredCraters
            ? { ...this.scene, craters: this.deferredCraters }
            : this.scene
        const key = hashSceneGeometry(terrainScene, this.metrics)
        if (key === this.terrainKey) return
        this.terrainKey = key
        const ctx = this.terrainCtx
        const { cssWidth: width, cssHeight: height } = this.metrics
        ctx.clearRect(0, 0, width, height)
        const theme = normalizedTheme(this.scene.theme)

        const groundTop = worldToCanvas({ x: 0, y: -5.25 }, this.metrics).y
        const surfaceY = (x: number) => groundTop
            + Math.sin(x * 0.033) * 4.2
            + Math.sin(x * 0.079 + 1.7) * 1.9
            + Math.sin(x * 0.157) * 0.8
        const groundPath = () => {
            ctx.beginPath()
            ctx.moveTo(0, surfaceY(0))
            for (let x = 0; x <= width; x += 12) {
                ctx.lineTo(x, surfaceY(x))
            }
            ctx.lineTo(width, height)
            ctx.lineTo(0, height)
            ctx.closePath()
        }
        if (terrainScene.groundVisible !== false) {
            const groundGradient = ctx.createLinearGradient(0, groundTop, 0, height)
            if (theme === "space") {
                groundGradient.addColorStop(0, "#93a4a5")
                groundGradient.addColorStop(0.08, "#5f7179")
                groundGradient.addColorStop(0.34, "#344552")
                groundGradient.addColorStop(1, "#1d2a36")
            } else if (theme === "canyon") {
                groundGradient.addColorStop(0, "#e2a06c")
                groundGradient.addColorStop(0.1, "#b86f4f")
                groundGradient.addColorStop(0.36, "#7d4d43")
                groundGradient.addColorStop(1, "#423039")
            } else {
                groundGradient.addColorStop(0, "#a4c866")
                groundGradient.addColorStop(0.08, "#6f964c")
                groundGradient.addColorStop(0.34, "#46693e")
                groundGradient.addColorStop(1, "#283c34")
            }
            ctx.fillStyle = groundGradient
            groundPath()
            ctx.fill()

            ctx.save()
            groundPath()
            ctx.clip()
            if (theme === "space") {
                ctx.globalAlpha = 0.34
                for (let row = 0; row < 5; row += 1) {
                    const y = groundTop + 18 + row * 22
                    ctx.strokeStyle = row % 2 === 0 ? "#8bd5de" : "#d2e0d9"
                    ctx.lineWidth = row % 2 === 0 ? 1.2 : 0.8
                    ctx.beginPath()
                    ctx.moveTo(0, y)
                    for (let x = 0; x <= width; x += 42) {
                        ctx.lineTo(x, y + Math.sin(x * 0.026 + row) * 3)
                    }
                    ctx.stroke()
                }
                ctx.globalAlpha = 0.22
                for (let index = 0; index < 24; index += 1) {
                    const x = (index * 113) % Math.max(1, width)
                    const y = groundTop + 12 + ((index * 47) % Math.max(1, height - groundTop - 24))
                    ctx.fillStyle = index % 3 === 0 ? "#8bf1f0" : "#17242e"
                    ctx.beginPath()
                    ctx.arc(x, y, 1.2 + (index % 4) * 0.5, 0, Math.PI * 2)
                    ctx.fill()
                }
            } else if (theme === "canyon") {
                ctx.globalAlpha = 0.36
                for (let row = 0; row < 7; row += 1) {
                    const y = groundTop + 10 + row * 15
                    ctx.strokeStyle = row % 2 === 0 ? "#f4c281" : "#6b3e3d"
                    ctx.lineWidth = row % 2 === 0 ? 1.4 : 1
                    ctx.beginPath()
                    ctx.moveTo(0, y)
                    for (let x = 0; x <= width; x += 32) {
                        ctx.lineTo(x, y + Math.sin(x * 0.037 + row * 0.8) * 2.4)
                    }
                    ctx.stroke()
                }
            } else {
                ctx.globalAlpha = 0.32
                for (let row = 0; row < 5; row += 1) {
                    const y = groundTop + 10 + row * 18
                    ctx.strokeStyle = row % 2 === 0 ? "#cde778" : "#31543a"
                    ctx.lineWidth = row % 2 === 0 ? 1.2 : 0.8
                    ctx.beginPath()
                    ctx.moveTo(0, y)
                    for (let x = 0; x <= width; x += 38) {
                        ctx.lineTo(x, y + Math.sin(x * 0.04 + row) * 2.2)
                    }
                    ctx.stroke()
                }
                ctx.globalAlpha = 0.24
                ctx.strokeStyle = "#eef6a1"
                ctx.lineWidth = 1
                for (let index = 0; index < 38; index += 1) {
                    const x = (index * 41) % Math.max(1, width)
                    const y = surfaceY(x) + 3 + (index % 5)
                    ctx.beginPath()
                    ctx.moveTo(x, y)
                    ctx.lineTo(x + 2 + (index % 3), y - 7 - (index % 4))
                    ctx.stroke()
                }
            }
            ctx.restore()

            ctx.save()
            ctx.lineCap = "round"
            ctx.lineJoin = "round"
            ctx.strokeStyle = theme === "space"
                ? "rgba(181, 237, 236, 0.76)"
                : theme === "canyon"
                    ? "rgba(255, 208, 137, 0.72)"
                    : "rgba(219, 243, 119, 0.82)"
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.moveTo(0, surfaceY(0) + 0.5)
            for (let x = 0; x <= width; x += 12) {
                ctx.lineTo(x, surfaceY(x) + 0.5)
            }
            ctx.stroke()
            ctx.strokeStyle = theme === "space"
                ? "rgba(29, 42, 54, 0.55)"
                : theme === "canyon"
                    ? "rgba(74, 42, 42, 0.46)"
                    : "rgba(35, 63, 39, 0.45)"
            ctx.lineWidth = 1.2
            ctx.beginPath()
            ctx.moveTo(0, surfaceY(0) + 5)
            for (let x = 0; x <= width; x += 12) {
                ctx.lineTo(x, surfaceY(x) + 5)
            }
            ctx.stroke()
            ctx.restore()
        }

        for (const obstacle of this.scene.obstacles) {
            if (!obstacle.destructible) continue
            this.drawDestructibleObstacle(ctx, obstacle, theme)
        }

        for (const crater of terrainScene.craters) {
            const center = worldToCanvas(crater, this.metrics)
            const radius = crater.radius * (this.metrics.scaleX + this.metrics.scaleY) / 2
            ctx.save()
            ctx.globalCompositeOperation = "source-atop"
            const rim = ctx.createRadialGradient(center.x, center.y, radius * 0.35, center.x, center.y, radius)
            rim.addColorStop(0, "rgba(27, 29, 28, 0.88)")
            rim.addColorStop(0.72, "rgba(45, 38, 33, 0.62)")
            rim.addColorStop(1, "rgba(255, 224, 165, 0.08)")
            ctx.fillStyle = rim
            ctx.beginPath()
            ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
            ctx.fill()
            ctx.globalCompositeOperation = "destination-out"
            ctx.beginPath()
            ctx.arc(center.x, center.y, radius * 0.76, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
        }
    }

    private drawDestructibleObstacle(
        ctx: CanvasRenderingContext2D,
        obstacle: FunctionWarsRenderObstacle,
        theme: "grassland" | "canyon" | "space",
    ) {
        const center = worldToCanvas(obstacle, this.metrics)
        const earth = obstacle.material !== "wood"
        const top = earth
            ? theme === "canyon" ? "#d48958" : theme === "space" ? "#849498" : "#8eb258"
            : "#d4944f"
        const mid = earth
            ? theme === "canyon" ? "#a65f48" : theme === "space" ? "#53666d" : "#617f45"
            : "#a7673f"
        const bottom = earth
            ? theme === "canyon" ? "#633f3d" : theme === "space" ? "#34434d" : "#3d543c"
            : "#65402d"
        const outline = earth
            ? theme === "canyon" ? "rgba(77, 45, 39, 0.72)" : theme === "space" ? "rgba(31, 43, 50, 0.76)" : "rgba(44, 68, 39, 0.72)"
            : "rgba(77, 45, 30, 0.78)"
        const gradient = ctx.createLinearGradient(center.x, center.y - 34, center.x, center.y + 48)
        gradient.addColorStop(0, top)
        gradient.addColorStop(0.42, mid)
        gradient.addColorStop(1, bottom)
        ctx.fillStyle = gradient
        ctx.strokeStyle = outline
        ctx.lineWidth = 2

        if (obstacle.shape === "circle") {
            const radius = (obstacle.radius ?? 1) * (this.metrics.scaleX + this.metrics.scaleY) / 2
            ctx.beginPath()
            ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
            ctx.save()
            ctx.beginPath()
            ctx.arc(center.x, center.y, radius * 0.96, 0, Math.PI * 2)
            ctx.clip()
            const highlight = ctx.createRadialGradient(
                center.x - radius * 0.34,
                center.y - radius * 0.42,
                radius * 0.08,
                center.x,
                center.y,
                radius,
            )
            highlight.addColorStop(0, theme === "space" ? "rgba(217, 239, 231, 0.34)" : "rgba(255, 235, 159, 0.32)")
            highlight.addColorStop(0.55, "rgba(255, 255, 255, 0)")
            highlight.addColorStop(1, "rgba(16, 27, 29, 0.2)")
            ctx.fillStyle = highlight
            ctx.fillRect(center.x - radius, center.y - radius, radius * 2, radius * 2)
            ctx.globalAlpha = earth ? 0.3 : 0.22
            for (let index = 0; index < 7; index += 1) {
                const angle = index * 1.73
                const distance = radius * (0.18 + (index % 5) * 0.13)
                const x = center.x + Math.cos(angle) * distance
                const y = center.y + Math.sin(angle) * distance * 0.72
                ctx.fillStyle = index % 2 === 0 ? bottom : top
                ctx.beginPath()
                ctx.ellipse(x, y, radius * 0.06, radius * 0.025, angle, 0, Math.PI * 2)
                ctx.fill()
            }
            ctx.restore()
            ctx.save()
            ctx.globalAlpha = 0.7
            ctx.fillStyle = outline
            for (const [angle, size] of [[-0.72, 0.11], [1.42, 0.08], [2.86, 0.1]] as const) {
                const x = center.x + Math.cos(angle) * radius * 0.94
                const y = center.y + Math.sin(angle) * radius * 0.94
                ctx.beginPath()
                ctx.ellipse(x, y, radius * size, radius * size * 0.55, angle, 0, Math.PI * 2)
                ctx.fill()
            }
            ctx.restore()
            return
        }

        const width = (obstacle.width ?? 1) * this.metrics.scaleX
        const height = (obstacle.height ?? 1) * this.metrics.scaleY
        const radius = Math.min(8, width * 0.09, height * 0.18)
        roundedRect(ctx, center.x - width / 2, center.y - height / 2, width, height, radius)
        ctx.fill()
        ctx.stroke()
        ctx.save()
        roundedRect(ctx, center.x - width / 2 + 1, center.y - height / 2 + 1, width - 2, height - 2, radius)
        ctx.clip()
        ctx.globalAlpha = 0.26
        ctx.fillStyle = bottom
        if (obstacle.material === "wood") {
            for (const [dx, dy, scale] of [[-0.25, -0.2, 0.07], [0.22, 0.22, 0.055]] as const) {
                ctx.beginPath()
                ctx.ellipse(
                    center.x + width * dx,
                    center.y + height * dy,
                    Math.max(2, width * scale),
                    Math.max(1.5, height * scale * 0.55),
                    0.2,
                    0,
                    Math.PI * 2,
                )
                ctx.fill()
            }
        } else {
            for (let index = 0; index < 7; index += 1) {
                const dx = ((index * 37) % 83) / 100 - 0.4
                const dy = ((index * 53) % 79) / 100 - 0.38
                ctx.beginPath()
                ctx.ellipse(
                    center.x + width * dx,
                    center.y + height * dy,
                    Math.max(1.4, width * 0.025),
                    Math.max(1, height * 0.018),
                    index * 0.7,
                    0,
                    Math.PI * 2,
                )
                ctx.fill()
            }
        }
        ctx.restore()
        ctx.save()
        ctx.globalAlpha = 0.72
        ctx.fillStyle = outline
        ctx.beginPath()
        ctx.moveTo(center.x - width * 0.18, center.y - height / 2)
        ctx.lineTo(center.x - width * 0.1, center.y - height / 2 + Math.max(3, height * 0.09))
        ctx.lineTo(center.x - width * 0.02, center.y - height / 2)
        ctx.closePath()
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(center.x + width / 2, center.y + height * 0.12)
        ctx.lineTo(center.x + width / 2 - Math.max(3, width * 0.05), center.y + height * 0.2)
        ctx.lineTo(center.x + width / 2, center.y + height * 0.28)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
    }

    private drawSolidObstacles(ctx: CanvasRenderingContext2D, now: number) {
        for (const obstacle of this.scene.obstacles) {
            if (obstacle.destructible) continue
            const center = worldToCanvas(obstacle, this.metrics)
            const theme = normalizedTheme(this.scene.theme)
            const isEarth = obstacle.material === "earth"
            const isMetal = obstacle.material === "metal" || obstacle.material === "steel" || normalizedTheme(this.scene.theme) === "space"
            const gradient = ctx.createLinearGradient(center.x - 30, center.y - 40, center.x + 35, center.y + 42)
            if (isEarth && theme === "grassland") {
                gradient.addColorStop(0, "#b7c2ab")
                gradient.addColorStop(0.24, "#708175")
                gradient.addColorStop(0.58, "#4b5e5d")
                gradient.addColorStop(1, "#2d3f46")
            } else if (isEarth && theme === "canyon") {
                gradient.addColorStop(0, "#b9aeb5")
                gradient.addColorStop(0.24, "#7b7483")
                gradient.addColorStop(0.58, "#554e62")
                gradient.addColorStop(1, "#332f45")
            } else if (isMetal) {
                gradient.addColorStop(0, "#d1d5c9")
                gradient.addColorStop(0.26, "#65737a")
                gradient.addColorStop(0.55, "#9ca8a5")
                gradient.addColorStop(1, "#394851")
            } else {
                gradient.addColorStop(0, "#9a929c")
                gradient.addColorStop(0.36, "#655f6e")
                gradient.addColorStop(0.72, "#413c4c")
                gradient.addColorStop(1, "#272636")
            }
            ctx.fillStyle = gradient
            ctx.strokeStyle = isEarth
                ? theme === "canyon" ? "rgba(226, 220, 238, 0.9)" : "rgba(222, 239, 229, 0.9)"
                : isMetal ? "rgba(225, 250, 242, 0.92)" : "rgba(218, 213, 225, 0.88)"
            ctx.lineWidth = 2.3
            if (obstacle.shape === "circle") {
                const radius = (obstacle.radius ?? 1) * (this.metrics.scaleX + this.metrics.scaleY) / 2
                ctx.beginPath()
                ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
                ctx.fill()
                ctx.stroke()
                ctx.save()
                ctx.beginPath()
                ctx.arc(center.x, center.y, radius * 0.94, 0, Math.PI * 2)
                ctx.clip()
                const sheen = ctx.createRadialGradient(
                    center.x - radius * 0.3,
                    center.y - radius * 0.4,
                    radius * 0.08,
                    center.x,
                    center.y,
                    radius,
                )
                sheen.addColorStop(0, isMetal ? "rgba(231, 255, 248, 0.38)" : "rgba(255, 229, 159, 0.32)")
                sheen.addColorStop(0.6, "rgba(255, 255, 255, 0)")
                sheen.addColorStop(1, "rgba(18, 23, 24, 0.18)")
                ctx.fillStyle = sheen
                ctx.fillRect(center.x - radius, center.y - radius, radius * 2, radius * 2)
                ctx.globalAlpha = 0.28
                ctx.strokeStyle = isMetal ? "#c0d9d8" : theme === "canyon" ? "#f0bb7a" : "#cce17a"
                ctx.lineWidth = 1
                for (let index = 0; index < 6; index += 1) {
                    const y = center.y - radius * 0.45 + index * radius * 0.17
                    ctx.beginPath()
                    ctx.moveTo(center.x - radius * 0.52, y)
                    ctx.lineTo(center.x + radius * 0.5, y + Math.sin(index) * radius * 0.04)
                    ctx.stroke()
                }
                ctx.restore()
                ctx.save()
                ctx.strokeStyle = isMetal ? "rgba(129, 247, 236, 0.82)" : "rgba(226, 233, 243, 0.8)"
                ctx.lineWidth = 2.4
                ctx.beginPath()
                ctx.arc(center.x, center.y, radius * 1.02, 0, Math.PI * 2)
                ctx.stroke()
                ctx.globalAlpha = 0.72
                ctx.fillStyle = isMetal ? "rgba(30, 46, 53, 0.82)" : "rgba(36, 38, 51, 0.78)"
                for (let index = 0; index < 6; index += 1) {
                    const angle = (Math.PI * 2 * index) / 6 + 0.35
                    ctx.beginPath()
                    ctx.arc(center.x + Math.cos(angle) * radius * 0.62, center.y + Math.sin(angle) * radius * 0.62, Math.max(1.6, radius * 0.045), 0, Math.PI * 2)
                    ctx.fill()
                }
                ctx.restore()
            } else {
                const width = (obstacle.width ?? 1) * this.metrics.scaleX
                const height = (obstacle.height ?? 1) * this.metrics.scaleY
                const radius = Math.min(6, width * 0.05, height * 0.18)
                roundedRect(ctx, center.x - width / 2, center.y - height / 2, width, height, radius)
                ctx.fill()
                ctx.stroke()
                ctx.save()
                roundedRect(ctx, center.x - width / 2 + 1, center.y - height / 2 + 1, width - 2, height - 2, radius)
                ctx.clip()
                if (isMetal) {
                    const glow = ctx.createLinearGradient(center.x - width / 2, center.y, center.x + width / 2, center.y)
                    glow.addColorStop(0, "rgba(65, 95, 112, 0.08)")
                    glow.addColorStop(0.5, "rgba(139, 238, 236, 0.24)")
                    glow.addColorStop(1, "rgba(31, 48, 60, 0.14)")
                    ctx.fillStyle = glow
                    ctx.fillRect(center.x - width / 2, center.y - height / 2, width, height)
                    ctx.globalAlpha = 0.45
                    ctx.strokeStyle = "#d5ece7"
                    ctx.lineWidth = 1
                    for (let x = center.x - width * 0.34; x <= center.x + width * 0.35; x += Math.max(12, width * 0.18)) {
                        ctx.beginPath()
                        ctx.moveTo(x, center.y - height * 0.42)
                        ctx.lineTo(x + width * 0.05, center.y + height * 0.42)
                        ctx.stroke()
                    }
                } else if (isEarth) {
                    ctx.globalAlpha = 0.44
                    ctx.fillStyle = theme === "grassland" ? "#dce8c8" : "#e0d8e4"
                    ctx.fillRect(center.x - width / 2, center.y - height / 2, width, Math.max(4, height * 0.16))
                    ctx.strokeStyle = theme === "grassland" ? "#243a43" : "#29283f"
                    ctx.lineWidth = 1.15
                    for (let y = center.y - height * 0.22; y < center.y + height * 0.42; y += Math.max(9, height * 0.18)) {
                        ctx.beginPath()
                        ctx.moveTo(center.x - width * 0.44, y)
                        ctx.lineTo(center.x + width * 0.44, y + Math.sin(y * 0.11) * 2)
                        ctx.stroke()
                    }
                } else {
                    ctx.globalAlpha = 0.3
                    ctx.strokeStyle = "#d5c2a3"
                    ctx.lineWidth = 1
                    ctx.beginPath()
                    ctx.moveTo(center.x - width * 0.38, center.y - height * 0.26)
                    ctx.lineTo(center.x - width * 0.05, center.y - height * 0.04)
                    ctx.lineTo(center.x - width * 0.25, center.y + height * 0.28)
                    ctx.moveTo(center.x + width * 0.12, center.y - height * 0.34)
                    ctx.lineTo(center.x + width * 0.34, center.y + height * 0.2)
                    ctx.stroke()
                }
                ctx.restore()
                ctx.save()
                ctx.strokeStyle = isMetal ? "rgba(137, 255, 238, 0.7)" : "rgba(235, 235, 245, 0.66)"
                ctx.lineWidth = 1.6
                ctx.beginPath()
                ctx.moveTo(center.x - width * 0.4, center.y - height * 0.36)
                ctx.lineTo(center.x + width * 0.36, center.y - height * 0.36)
                ctx.stroke()
                ctx.globalAlpha = 0.62
                ctx.strokeStyle = isMetal ? "rgba(136, 255, 238, 0.46)" : "rgba(246, 242, 255, 0.36)"
                ctx.lineWidth = 1
                for (let x = center.x - width * 0.58; x < center.x + width * 0.62; x += Math.max(12, width * 0.18)) {
                    ctx.beginPath()
                    ctx.moveTo(x, center.y + height * 0.48)
                    ctx.lineTo(x + width * 0.16, center.y - height * 0.48)
                    ctx.stroke()
                }
                ctx.restore()
                ctx.fillStyle = isMetal ? "rgba(21, 32, 37, 0.62)" : "rgba(31, 33, 48, 0.6)"
                const boltRadius = Math.max(1.5, Math.min(width, height) * 0.033)
                for (const [dx, dy] of [[-0.38, -0.36], [0.38, -0.36], [-0.38, 0.36], [0.38, 0.36]]) {
                    ctx.beginPath()
                    ctx.arc(center.x + width * Number(dx), center.y + height * Number(dy), boltRadius, 0, Math.PI * 2)
                    ctx.fill()
                }
            }

            if (this.obstacleImpact?.obstacleId === obstacle.id) {
                const elapsed = now - this.obstacleImpact.startedAt
                if (elapsed < 260) {
                    ctx.save()
                    ctx.strokeStyle = `rgba(225, 248, 223, ${1 - elapsed / 260})`
                    ctx.lineWidth = 5
                    ctx.shadowColor = "rgba(225, 248, 223, 0.75)"
                    ctx.shadowBlur = 12
                    if (obstacle.shape === "circle") {
                        const radius = (obstacle.radius ?? 1) * (this.metrics.scaleX + this.metrics.scaleY) / 2
                        ctx.beginPath()
                        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
                    } else {
                        const width = (obstacle.width ?? 1) * this.metrics.scaleX
                        const height = (obstacle.height ?? 1) * this.metrics.scaleY
                        roundedRect(ctx, center.x - width / 2, center.y - height / 2, width, height, 3)
                    }
                    ctx.stroke()
                    ctx.restore()
                }
            }
        }
    }

    private drawCrates(ctx: CanvasRenderingContext2D, now: number) {
        const crateImage = this.asset("unit:crate")
        for (let index = 0; index < this.scene.crates.length; index += 1) {
            const crate = this.scene.crates[index]
            if (crate.active === false) continue
            const point = worldToCanvas(crate, this.metrics)
            const bob = now === 0 ? 0 : Math.sin(now / 420 + index * 1.7) * 3.2
            if (crate.type === "relay") {
                const pulse = now === 0 ? 0.5 : (Math.sin(now / 360 + index) + 1) / 2
                const radius = Math.max(8, this.metrics.scaleX * 0.28)
                ctx.save()
                ctx.translate(point.x, point.y + bob * 0.45)
                ctx.strokeStyle = this.scene.theme === "canyon" ? "rgba(255, 190, 72, 0.92)" : "rgba(105, 232, 226, 0.94)"
                ctx.fillStyle = this.scene.theme === "canyon" ? "rgba(87, 52, 20, 0.9)" : "rgba(17, 55, 66, 0.9)"
                ctx.lineWidth = 2
                ctx.shadowColor = ctx.strokeStyle
                ctx.shadowBlur = 10 + pulse * 8
                ctx.beginPath()
                ctx.arc(0, 0, radius * (1.45 + pulse * 0.22), 0, Math.PI * 2)
                ctx.stroke()
                ctx.beginPath()
                ctx.arc(0, 0, radius, 0, Math.PI * 2)
                ctx.fill()
                ctx.stroke()
                ctx.shadowBlur = 0
                ctx.beginPath()
                ctx.moveTo(-radius * 0.52, 0)
                ctx.lineTo(-radius * 0.16, radius * 0.38)
                ctx.lineTo(radius * 0.52, -radius * 0.38)
                ctx.stroke()
                ctx.restore()
                continue
            }
            const size = Math.max(30, this.metrics.scaleX * 1.05)
            ctx.save()
            ctx.translate(point.x, point.y + bob)
            ctx.shadowColor = "rgba(240, 196, 54, 0.72)"
            ctx.shadowBlur = 14
            if (crateImage) {
                ctx.drawImage(crateImage, -size / 2, -size / 2, size, size)
            } else {
                ctx.fillStyle = "#f1bd38"
                ctx.strokeStyle = "#4e4b3c"
                ctx.lineWidth = 2
                roundedRect(ctx, -size / 2, -size / 2, size, size, 4)
                ctx.fill()
                ctx.stroke()
                ctx.shadowBlur = 0
                ctx.fillStyle = "#52615b"
                ctx.fillRect(-size * 0.08, -size * 0.34, size * 0.16, size * 0.68)
                ctx.fillRect(-size * 0.34, -size * 0.08, size * 0.68, size * 0.16)
            }
            ctx.restore()
        }
    }

    private drawUnits(ctx: CanvasRenderingContext2D, now: number) {
        for (const sceneUnit of this.scene.units) {
            const pending = this.pendingDestroyedUnits.has(sceneUnit.id)
            const unit = pending ? this.pendingUnitSnapshots.get(sceneUnit.id) ?? sceneUnit : sceneUnit
            if (sceneUnit.alive === false && !pending && !this.destroyedUnits.has(sceneUnit.id)) continue
            const point = worldToCanvas(unit, this.metrics)
            const popStartedAt = this.destroyedUnits.get(sceneUnit.id)
            const falling = sceneUnit.falling === true
            const animationMs = this.destroyedUnitAnimationMs(sceneUnit.id)
            const popProgress = popStartedAt == null ? 0 : Math.min(1, (now - popStartedAt) / animationMs)
            if (popProgress >= 1) {
                this.destroyedUnits.delete(sceneUnit.id)
                continue
            }
            const scale = falling
                ? 1 - popProgress * 0.22
                : popProgress > 0 ? 1 + Math.sin(popProgress * Math.PI) * 0.35 : 1
            const alpha = falling
                ? 1 - popProgress * 0.72
                : popProgress > 0 ? 1 - popProgress : 1
            const active = this.scene.activeSide === unit.side
            const imageKey = unit.side === "player" || unit.side === "host" || unit.side === "guest"
                ? "unit:player"
                : unit.armored ? "unit:armored" : "unit:enemy"
            const image = this.asset(imageKey)
            const width = Math.max(unit.armored ? 48 : 42, this.metrics.scaleX * (unit.armored ? 1.7 : 1.48))
            const height = width * 0.76
            const visualDrop = getFunctionWarsUnitVisualDrop(
                unit,
                this.scene.obstacles,
                this.metrics,
                height,
            )

            ctx.save()
            ctx.globalAlpha = alpha
            const fallDrop = falling ? Math.pow(popProgress, 1.55) * this.metrics.cssHeight * 0.58 : 0
            ctx.translate(point.x, point.y + visualDrop + fallDrop)
            if (falling) {
                const direction = unit.facing === "left" ? -1 : 1
                ctx.rotate(direction * popProgress * 0.72)
            }
            ctx.scale((unit.facing === "left" ? -1 : 1) * scale, scale)
            if (active) {
                ctx.fillStyle = "rgba(244, 199, 56, 0.2)"
                ctx.beginPath()
                ctx.ellipse(0, height * 0.1, width * 0.72, height * 0.65, 0, 0, Math.PI * 2)
                ctx.fill()
            }
            if (image) {
                ctx.drawImage(image, -width / 2, -height * 0.78, width, height)
            } else {
                this.drawFallbackUnit(ctx, unit, width, height)
            }
            if (unit.shield) {
                ctx.strokeStyle = "rgba(91, 202, 219, 0.82)"
                ctx.lineWidth = 2
                ctx.shadowColor = "rgba(91, 202, 219, 0.8)"
                ctx.shadowBlur = 12
                ctx.beginPath()
                ctx.ellipse(0, -height * 0.32, width * 0.7, height * 0.76, 0, 0, Math.PI * 2)
                ctx.stroke()
            }
            ctx.restore()

            if (!falling && unit.hp != null && unit.maxHp && unit.maxHp > 0) {
                const ratio = Math.max(0, Math.min(1, unit.hp / unit.maxHp))
                const barWidth = width * 0.86
                const barY = point.y + visualDrop - height - 7
                ctx.fillStyle = "rgba(27, 36, 37, 0.72)"
                roundedRect(ctx, point.x - barWidth / 2, barY, barWidth, 4, 2)
                ctx.fill()
                ctx.fillStyle = ratio > 0.45 ? "#62b86f" : "#e3543f"
                roundedRect(ctx, point.x - barWidth / 2, barY, barWidth * ratio, 4, 2)
                ctx.fill()
            }
        }
    }

    private drawFallbackUnit(
        ctx: CanvasRenderingContext2D,
        unit: FunctionWarsRenderUnit,
        width: number,
        height: number,
    ) {
        const enemy = unit.side === "enemy"
        const main = enemy ? (unit.armored ? "#d8533f" : "#e78e3c") : "#4e8e68"
        const dark = enemy ? "#653d37" : "#2f5148"
        ctx.fillStyle = "rgba(33, 39, 37, 0.28)"
        ctx.beginPath()
        ctx.ellipse(0, height * 0.03, width * 0.5, height * 0.14, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = dark
        roundedRect(ctx, -width * 0.43, -height * 0.18, width * 0.86, height * 0.26, height * 0.1)
        ctx.fill()
        ctx.fillStyle = main
        roundedRect(ctx, -width * 0.3, -height * 0.52, width * 0.6, height * 0.4, height * 0.14)
        ctx.fill()
        ctx.strokeStyle = "rgba(243, 239, 207, 0.7)"
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.fillStyle = dark
        roundedRect(ctx, width * 0.12, -height * 0.43, width * 0.55, height * 0.11, height * 0.05)
        ctx.fill()
        ctx.fillStyle = "#f3d783"
        ctx.beginPath()
        ctx.arc(-width * 0.11, -height * 0.37, width * 0.06, 0, Math.PI * 2)
        ctx.fill()
        if (unit.armored) {
            ctx.fillStyle = "rgba(236, 236, 214, 0.48)"
            ctx.fillRect(-width * 0.22, -height * 0.46, width * 0.44, height * 0.1)
        }
    }

    private drawGhostTraces(ctx: CanvasRenderingContext2D) {
        ctx.save()
        ctx.setLineDash([5, 6])
        ctx.lineWidth = 1.4
        ctx.strokeStyle = "rgba(44, 58, 59, 0.52)"
        for (const trace of this.scene.ghostTraces ?? []) {
            this.strokeTrace(ctx, trace.points, 1)
        }
        ctx.restore()
    }

    private drawActiveTraces(ctx: CanvasRenderingContext2D, now: number) {
        if (this.scene.traces.length === 0) return
        const duration = this.animationDurationMs()
        const progress = this.reduceMotion || this.animationKey === null
            ? 1
            : Math.max(0, Math.min(1, (now - this.animationStartedAt) / duration))

        for (let index = 0; index < this.scene.traces.length; index += 1) {
            const trace = this.scene.traces[index]
            const delay = Math.min(0.18, index * 0.04)
            const localProgress = progress <= delay
                ? 0
                : Math.min(1, (progress - delay) / (1 - delay))
            const color = trace.color ?? (trace.mirrored ? "#ed6b52" : "#f0c33e")
            ctx.save()
            ctx.strokeStyle = color
            ctx.lineWidth = 2.4
            ctx.shadowColor = color
            ctx.shadowBlur = 10
            const launchOrigin = trace.sourceUnitId
                ? this.getUnitMuzzleCanvasPoint(trace.sourceUnitId)
                : null
            const firstPoint = trace.points[0]
                ? worldToCanvas(trace.points[0], this.metrics)
                : null
            const launchDistance = launchOrigin && firstPoint
                ? Math.hypot(firstPoint.x - launchOrigin.x, firstPoint.y - launchOrigin.y)
                : 0
            const launchShare = launchDistance > 5 ? 0.14 : 0
            let head: FunctionWarsPoint | null = null

            if (launchOrigin && firstPoint && localProgress < launchShare) {
                const launchProgress = localProgress / launchShare
                const eased = 1 - (1 - launchProgress) ** 3
                head = {
                    x: launchOrigin.x + (firstPoint.x - launchOrigin.x) * eased,
                    y: launchOrigin.y + (firstPoint.y - launchOrigin.y) * eased,
                }
                ctx.globalAlpha = 0.34 + launchProgress * 0.66
                ctx.beginPath()
                ctx.moveTo(launchOrigin.x, launchOrigin.y)
                ctx.lineTo(head.x, head.y)
                ctx.stroke()
                ctx.globalAlpha = 1

                ctx.fillStyle = `rgba(255, 246, 207, ${1 - launchProgress})`
                ctx.beginPath()
                ctx.arc(launchOrigin.x, launchOrigin.y, 2 + (1 - launchProgress) * 4, 0, Math.PI * 2)
                ctx.fill()
            } else {
                if (launchOrigin && firstPoint && launchShare > 0) {
                    ctx.save()
                    ctx.globalAlpha = 0.22 + (1 - localProgress) * 0.2
                    ctx.lineWidth = 1.6
                    ctx.shadowBlur = 4
                    ctx.beginPath()
                    ctx.moveTo(launchOrigin.x, launchOrigin.y)
                    ctx.lineTo(firstPoint.x, firstPoint.y)
                    ctx.stroke()
                    ctx.restore()
                }
                const traceProgress = launchShare > 0
                    ? Math.max(0, (localProgress - launchShare) / (1 - launchShare))
                    : localProgress
                head = this.strokeTrace(ctx, trace.points, traceProgress)
            }
            if (head && localProgress < 1) {
                ctx.fillStyle = "#fff6cf"
                ctx.beginPath()
                ctx.arc(head.x, head.y, 3.5, 0, Math.PI * 2)
                ctx.fill()
                ctx.fillStyle = color
                ctx.beginPath()
                ctx.arc(head.x, head.y, 1.8, 0, Math.PI * 2)
                ctx.fill()
            }
            ctx.restore()
        }
    }

    private getUnitMuzzleCanvasPoint(unitId: string): FunctionWarsPoint | null {
        const sceneUnit = this.scene.units.find((unit) => unit.id === unitId)
        if (!sceneUnit) return null
        const pending = this.pendingDestroyedUnits.has(sceneUnit.id)
        const unit = pending ? this.pendingUnitSnapshots.get(sceneUnit.id) ?? sceneUnit : sceneUnit
        const point = worldToCanvas(unit, this.metrics)
        const width = Math.max(unit.armored ? 48 : 42, this.metrics.scaleX * (unit.armored ? 1.7 : 1.48))
        const height = width * 0.76
        const visualDrop = getFunctionWarsUnitVisualDrop(
            unit,
            this.scene.obstacles,
            this.metrics,
            height,
        )
        const direction = unit.facing === "left" ? -1 : 1
        return {
            x: point.x + direction * width * 0.3,
            y: point.y + visualDrop - height * 0.56,
        }
    }

    private strokeTrace(
        ctx: CanvasRenderingContext2D,
        points: FunctionWarsPoint[],
        progress: number,
    ): FunctionWarsPoint | null {
        if (points.length < 2 || progress <= 0) return null
        const visibleCount = Math.max(2, Math.ceil(points.length * progress))
        ctx.beginPath()
        let head: FunctionWarsPoint | null = null
        for (let index = 0; index < visibleCount && index < points.length; index += 1) {
            const point = worldToCanvas(points[index], this.metrics)
            if (index === 0) ctx.moveTo(point.x, point.y)
            else ctx.lineTo(point.x, point.y)
            head = point
        }
        ctx.stroke()
        return head
    }

    private drawParticles(ctx: CanvasRenderingContext2D) {
        for (const particle of this.particles) {
            const point = worldToCanvas(particle, this.metrics)
            const alpha = Math.max(0, particle.life / particle.maxLife)
            ctx.fillStyle = particle.color
            ctx.globalAlpha = alpha
            ctx.beginPath()
            ctx.arc(point.x, point.y, particle.size * (0.55 + alpha * 0.45), 0, Math.PI * 2)
            ctx.fill()
        }
        ctx.globalAlpha = 1
    }

    private drawVignette(ctx: CanvasRenderingContext2D) {
        const { cssWidth: width, cssHeight: height } = this.metrics
        const vignette = ctx.createRadialGradient(width / 2, height * 0.44, height * 0.22, width / 2, height / 2, width * 0.72)
        vignette.addColorStop(0, "rgba(22, 31, 31, 0)")
        vignette.addColorStop(1, "rgba(18, 27, 28, 0.2)")
        ctx.fillStyle = vignette
        ctx.fillRect(0, 0, width, height)
    }
}
