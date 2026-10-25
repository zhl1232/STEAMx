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

// Match the world rectangle so circles, blast radii and trajectory slopes share one scale.
export const FUNCTION_WARS_CANVAS_ASPECT_RATIO = 12 / 7

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
    offsetX: number
    offsetY: number
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
    weapon?: "standard" | "heavy" | "drill" | "split" | "mirror"
}

export type FunctionWarsRenderImpact = FunctionWarsPoint & {
    id: string
    color?: string
    intensity?: number
    unitId?: string
    obstacleId?: string
    material?: FunctionWarsRenderObstacle["material"]
    weapon?: FunctionWarsRenderTrace["weapon"]
}

export type FunctionWarsRenderFeedbackLabel = {
    x: number
    y: number
    text: string
    preview?: boolean
}

export type FunctionWarsRenderScene = {
    theme: FunctionWarsRenderTheme
    obstacles: FunctionWarsRenderObstacle[]
    craters: FunctionWarsRenderCrater[]
    units: FunctionWarsRenderUnit[]
    crates: FunctionWarsRenderCrate[]
    traces: FunctionWarsRenderTrace[]
    ghostTraces?: FunctionWarsRenderTrace[]
    previewTraces?: FunctionWarsRenderTrace[]
    feedbackLabels?: FunctionWarsRenderFeedbackLabel[]
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
    kind?: "dust" | "chip" | "spark"
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

const INACTIVE_AMBIENT_FRAME_MS = 250
const MAX_PARTICLES = 96

const THEME_ASSET_PATHS = {
    units: {
        player: "/assets/playground-art/function-wars/v2/player-turret.webp",
        enemy: "/assets/playground-art/function-wars/v2/enemy.webp",
        armored: "/assets/playground-art/function-wars/v2/enemy-armored.webp",
        crate: "/assets/playground-art/function-wars/v2/crate.webp",
    } as Record<string, string>,
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
    containerHeight?: number,
): FunctionWarsCanvasMetrics {
    const cssWidth = Math.max(1, finitePositive(containerWidth, 1))
    const cssHeight = finitePositive(containerHeight ?? 0, cssWidth / FUNCTION_WARS_CANVAS_ASPECT_RATIO)
    const dpr = Math.min(3, finitePositive(devicePixelRatio, 1))
    const worldWidth = FUNCTION_WARS_WORLD_BOUNDS.maxX - FUNCTION_WARS_WORLD_BOUNDS.minX
    const worldHeight = FUNCTION_WARS_WORLD_BOUNDS.maxY - FUNCTION_WARS_WORLD_BOUNDS.minY

    const scale = Math.min(cssWidth / worldWidth, cssHeight / worldHeight)
    return {
        cssWidth,
        cssHeight,
        pixelWidth: Math.max(1, Math.round(cssWidth * dpr)),
        pixelHeight: Math.max(1, Math.round(cssHeight * dpr)),
        dpr,
        scaleX: scale,
        scaleY: scale,
        offsetX: (cssWidth - worldWidth * scale) / 2,
        offsetY: (cssHeight - worldHeight * scale) / 2,
    }
}

export function worldToCanvas(
    point: FunctionWarsPoint,
    metrics: Pick<FunctionWarsCanvasMetrics, "cssWidth" | "cssHeight">,
): FunctionWarsPoint {
    const { minX, maxY } = FUNCTION_WARS_WORLD_BOUNDS
    const scale = Math.min(metrics.cssWidth / 24, metrics.cssHeight / 14)
    const offsetX = (metrics.cssWidth - 24 * scale) / 2
    const offsetY = (metrics.cssHeight - 14 * scale) / 2
    return {
        x: offsetX + (point.x - minX) * scale,
        y: offsetY + (maxY - point.y) * scale,
    }
}

export function canvasToWorld(
    point: FunctionWarsPoint,
    metrics: Pick<FunctionWarsCanvasMetrics, "cssWidth" | "cssHeight">,
): FunctionWarsPoint {
    const { minX, maxY } = FUNCTION_WARS_WORLD_BOUNDS
    const scale = Math.min(metrics.cssWidth / 24, metrics.cssHeight / 14)
    const offsetX = (metrics.cssWidth - 24 * scale) / 2
    const offsetY = (metrics.cssHeight - 14 * scale) / 2
    return {
        x: minX + (point.x - offsetX) / scale,
        y: maxY - (point.y - offsetY) / scale,
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
    artContactRatio = 0.11,
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
    const artContactOffset = Math.max(0, spriteHeight) * artContactRatio
    return Math.max(0, supportPoint.y - unitPoint.y - artContactOffset)
}

function hashSceneGeometry(scene: FunctionWarsRenderScene, metrics: FunctionWarsCanvasMetrics): string {
    const obstacleKey = scene.obstacles
        .map((obstacle) => `${obstacle.id}:${obstacle.shape}:${obstacle.material}:${obstacle.destructible}:${obstacle.x}:${obstacle.y}:${obstacle.width}:${obstacle.height}:${obstacle.radius}`)
        .join("|")
    const craterKey = scene.craters.map((crater) => `${crater.x}:${crater.y}:${crater.radius}`).join("|")
    return `${normalizedTheme(scene.theme)}:${scene.groundVisible !== false ? "ground" : "void"}:${metrics.cssWidth}:${metrics.cssHeight}:${metrics.dpr}:${metrics.scaleX}:${metrics.scaleY}:${metrics.offsetX}:${metrics.offsetY}:${obstacleKey}:${craterKey}`
}

export class FunctionWarsRenderer {
    private readonly canvas: HTMLCanvasElement
    private readonly ctx: CanvasRenderingContext2D
    private readonly terrainCanvas: HTMLCanvasElement
    private readonly terrainCtx: CanvasRenderingContext2D
    private metrics: FunctionWarsCanvasMetrics
    private scene: FunctionWarsRenderScene = DEFAULT_SCENE
    private labelExclusions: FunctionWarsCoverRect[] = []
    private frameId: number | null = null
    private wakeTimerId: number | null = null
    private running = false
    private destroyed = false
    private intersecting = true
    private lastFrameAt = 0
    private terrainKey = ""
    private labelAnchorTerrainKey = ""
    private obstacleLabelAnchors = new Map<string, FunctionWarsPoint | null>()
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

    resize(containerWidth: number, devicePixelRatio = window.devicePixelRatio || 1, containerHeight?: number) {
        if (this.destroyed) return
        const metrics = getFunctionWarsCanvasMetrics(containerWidth, devicePixelRatio, containerHeight)
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

    setLabelExclusions(rects: FunctionWarsCoverRect[]) {
        if (this.destroyed) return
        const next = rects.filter((rect) => Number.isFinite(rect.x) && Number.isFinite(rect.y)
            && Number.isFinite(rect.width) && Number.isFinite(rect.height) && rect.width > 0 && rect.height > 0)
            .map((rect) => ({ ...rect }))
        if (next.length === this.labelExclusions.length && next.every((rect, index) => {
            const previous = this.labelExclusions[index]
            return rect.x === previous.x && rect.y === previous.y && rect.width === previous.width && rect.height === previous.height
        })) return
        this.labelExclusions = next
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
        this.labelExclusions = []
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
        const material = impact.material ?? this.scene.obstacles.find((obstacle) => obstacle.id === impact.obstacleId)?.material
        const kind = impact.unitId || material === "metal" || material === "steel" ? "spark" : material === "wood" ? "chip" : "dust"
        const colors = impact.color && !material && !impact.unitId
            ? [impact.color, "#fff0ac", "#e84b32"]
            : kind === "spark" ? ["#fff4ba", "#f6ba52", "#e97534"]
                : kind === "chip" ? ["#dba265", "#8e5736", "#f1c591"]
                    : ["#c4a27c", "#8f755d", "#e4ceaa"]
        const count = Math.min(40, Math.max(14, Math.round(impact.intensity ?? 28)))
        this.particles = this.particles.slice(-Math.max(0, MAX_PARTICLES - count))
        for (let index = 0; index < count; index += 1) {
            const angle = (Math.PI * 2 * index) / count + Math.random() * 0.32
            const speed = (impact.weapon === "drill" ? 1.4 : 2.2) + Math.random() * (impact.weapon === "heavy" ? 8 : 6.2)
            this.particles.push({
                x: impact.x,
                y: impact.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed + 1.6,
                gravity: -9.5,
                life: 0.3 + Math.random() * 0.4,
                maxLife: 1,
                size: 2 + Math.random() * 4.5,
                color: colors[index % colors.length],
                kind,
            })
        }
        this.shake = Math.min(12, (impact.weapon === "heavy" ? 7 : 4) + count / 8)
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
        const delay = active ? 0 : INACTIVE_AMBIENT_FRAME_MS
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
        const theme = normalizedTheme(scene.theme)
        this.loadAsset(`backdrop:${theme}`, `/assets/playground-art/function-wars/v2/${theme}-backdrop.webp`)
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

    private loadAsset(key: string, path: string) {
        if (this.destroyed || this.assets.has(key)) return
        const image = new Image()
        const record: LoadedAsset = { image, ready: false, failed: false }
        this.assets.set(key, record)
        image.onload = () => {
            if (this.destroyed || this.assets.get(key) !== record) return
            record.ready = true
            this.draw(performance.now())
        }
        image.onerror = () => {
            if (this.destroyed || this.assets.get(key) !== record) return
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
        this.drawCoordinateGrid(ctx)
        this.rebuildTerrainIfNeeded()
        ctx.drawImage(this.terrainCanvas, 0, 0, width, height)
        this.drawSolidObstacles(ctx, now)
        this.drawCrates(ctx, motionNow)
        this.drawPreviewTraces(ctx)
        this.drawGhostTraces(ctx)
        this.drawUnits(ctx, now)
        this.drawActiveTraces(ctx, now)
        this.drawParticles(ctx)
        this.drawImpactMarker(ctx)
        this.drawSceneLabels(ctx)
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
        const gradient = ctx.createLinearGradient(0, 0, 0, height)
        const colors = theme === "space"
            ? ["#17283d", "#30475b"]
            : theme === "canyon" ? ["#f4e5d0", "#ebc7a4"] : ["#e8f3ed", "#cedfc7"]
        gradient.addColorStop(0, colors[0])
        gradient.addColorStop(1, colors[1])
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, width, height)

        const backdrop = this.asset(`backdrop:${theme}`)
        if (backdrop) {
            const motion = getFunctionWarsBackgroundMotion(theme, width, height, now).far
            const rect = getFunctionWarsCoverRect(backdrop.naturalWidth, backdrop.naturalHeight, width, height, {
                overscan: width * 0.018, offsetX: motion.x, offsetY: motion.y,
            })
            ctx.save()
            ctx.globalAlpha = theme === "space" ? 0.82 : 0.92
            ctx.drawImage(backdrop, rect.x, rect.y, rect.width, rect.height)
            ctx.fillStyle = theme === "space" ? "rgba(19, 38, 54, 0.16)" : "rgba(242, 245, 220, 0.04)"
            ctx.fillRect(0, 0, width, height)
            ctx.restore()
            return
        }

        // Scenery stays soft and sparse; only outlined terrain is collidable.
        if (theme === "space") {
            // A translucent orbital disc has no terrain edge or collision outline.
            ctx.fillStyle = "rgba(166, 197, 218, 0.08)"
            ctx.beginPath()
            ctx.arc(width * 0.78, height * 0.23, height * 0.12, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = "rgba(166, 197, 218, 0.1)"
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.ellipse(width * 0.78, height * 0.23, height * 0.21, height * 0.045, -0.3, 0, Math.PI * 2)
            ctx.stroke()
            for (let index = 0; index < 18; index += 1) {
                const x = ((index * 149 + 37) % 997) / 997 * width
                const y = ((index * 83 + 19) % 421) / 421 * height
                const alpha = 0.15 + Math.sin(now / 3000 + index) * 0.04
                ctx.fillStyle = `rgba(216, 234, 243, ${alpha})`
                ctx.beginPath()
                ctx.arc(x, y, index % 5 === 0 ? 1.2 : 0.7, 0, Math.PI * 2)
                ctx.fill()
            }
        } else {
            // Broad distant ridges and cloud strokes are atmospheric, without the
            // crisp outlines and surface detail reserved for playable terrain.
            for (let layer = 0; layer < 2; layer += 1) {
                ctx.fillStyle = theme === "canyon"
                    ? `rgba(166, 106, 76, ${0.045 + layer * 0.02})`
                    : `rgba(64, 111, 82, ${0.04 + layer * 0.02})`
                ctx.beginPath()
                ctx.moveTo(0, height)
                for (let step = 0; step <= 32; step += 1) {
                    const phase = step / 32
                    const ridge = theme === "canyon"
                        ? Math.round(Math.sin(phase * 14 + layer * 2) * 2) / 2
                        : Math.sin(phase * 9 + layer * 2)
                    ctx.lineTo(width * phase, height * (0.67 + layer * 0.1 + ridge * 0.045))
                }
                ctx.lineTo(width, height)
                ctx.closePath()
                ctx.fill()
            }
            ctx.strokeStyle = theme === "canyon" ? "rgba(255, 249, 231, 0.45)" : "rgba(255, 255, 251, 0.55)"
            ctx.lineWidth = Math.max(4, width * 0.007)
            ctx.lineCap = "round"
            for (const [x, y, length] of [[0.2, 0.22, 0.1], [0.66, 0.14, 0.13], [0.81, 0.34, 0.07]]) {
                ctx.beginPath()
                ctx.moveTo(width * x, height * y)
                ctx.lineTo(width * (x + length), height * y)
                ctx.stroke()
                ctx.beginPath()
                ctx.moveTo(width * (x + length * 0.24), height * y - 7)
                ctx.lineTo(width * (x + length * 0.7), height * y - 7)
                ctx.stroke()
            }
            ctx.lineCap = "butt"
        }
    }

    private coordinateOrigin(): FunctionWarsRenderUnit | undefined {
        return this.scene.units.find((unit) => unit.side === this.scene.activeSide && unit.alive !== false)
            ?? this.scene.units.find((unit) => unit.side === "player" && unit.alive !== false)
    }

    private drawCoordinateGrid(ctx: CanvasRenderingContext2D) {
        const { offsetX: left, offsetY: top, scaleX } = this.metrics
        const width = scaleX * 24
        const height = scaleX * 14
        const right = left + width
        const bottom = top + height
        const origin = this.coordinateOrigin() ?? { x: 0, y: 0, facing: "right" }
        const dark = normalizedTheme(this.scene.theme) === "space"
        const direction = origin.facing === "left" ? -1 : 1
        const axis = worldToCanvas(origin, this.metrics)
        const tickStep = width < 500 ? 4 : 2
        const axisNameX = Math.max(left + 24, Math.min(right - 24, axis.x + direction * scaleX * 1.7))
        const ink = dark ? "#dcecf3" : "#365648"
        ctx.save()
        ctx.beginPath()
        ctx.rect(left, top, width, height)
        ctx.clip()
        if (this.animationKey !== null && !this.reduceMotion && performance.now() - this.animationStartedAt < this.animationDurationMs()) ctx.globalAlpha = 0.62
        ctx.font = "600 11px ui-sans-serif, system-ui, sans-serif"
        ctx.textAlign = "center"
        ctx.textBaseline = "top"
        for (let x = Math.ceil(-12 - origin.x); x <= 12 - origin.x; x += 1) {
            if (x === 0) continue
            const point = worldToCanvas({ x: origin.x + x, y: origin.y }, this.metrics)
            if (this.scene.gridVisible) {
                ctx.strokeStyle = dark ? "rgba(199, 223, 238, 0.065)" : "rgba(42, 74, 65, 0.045)"
                ctx.lineWidth = 1
                ctx.beginPath()
                ctx.moveTo(point.x, top)
                ctx.lineTo(point.x, bottom)
                ctx.stroke()
            }
            if (x % tickStep === 0 && point.x > left + 10 && point.x < right - 10 && Math.abs(point.x - axisNameX) > 24 && axis.y > top + 32) {
                ctx.strokeStyle = ink
                ctx.lineWidth = 1
                ctx.beginPath()
                ctx.moveTo(point.x, axis.y - 3)
                ctx.lineTo(point.x, axis.y + 3)
                ctx.stroke()
                ctx.fillStyle = ink
                ctx.fillText(String(x * direction), point.x, Math.max(top + 4, Math.min(bottom - 16, axis.y + 5)))
            }
        }
        for (let y = Math.ceil(-7 - origin.y); y <= 7 - origin.y; y += 1) {
            if (y === 0) continue
            const point = worldToCanvas({ x: origin.x, y: origin.y + y }, this.metrics)
            if (this.scene.gridVisible) {
                ctx.strokeStyle = dark ? "rgba(199, 223, 238, 0.065)" : "rgba(42, 74, 65, 0.045)"
                ctx.lineWidth = 1
                ctx.beginPath()
                ctx.moveTo(left, point.y)
                ctx.lineTo(right, point.y)
                ctx.stroke()
            }
            if (y % tickStep === 0 && point.y > top + 38 && point.y < bottom - 10) {
                ctx.strokeStyle = ink
                ctx.lineWidth = 1
                ctx.beginPath()
                ctx.moveTo(axis.x - 3, point.y)
                ctx.lineTo(axis.x + 3, point.y)
                ctx.stroke()
                ctx.fillStyle = ink
                ctx.textAlign = "left"
                ctx.textBaseline = "middle"
                ctx.fillText(String(y), Math.max(left + 5, Math.min(right - 20, axis.x + 5)), point.y)
            }
        }
        ctx.strokeStyle = dark ? "rgba(221, 240, 245, 0.48)" : "rgba(42, 74, 65, 0.36)"
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(axis.x, top)
        ctx.lineTo(axis.x, bottom)
        ctx.moveTo(left, axis.y)
        ctx.lineTo(right, axis.y)
        ctx.stroke()
        ctx.fillStyle = ink
        ctx.textAlign = "center"
        ctx.textBaseline = "top"
        ctx.fillText(direction < 0 ? "← x" : "x →", axisNameX, Math.max(top + 34, Math.min(bottom - 16, axis.y + 5)))
        ctx.restore()

        // Short edge ticks mark the simulation extent without suggesting a wall.
        ctx.save()
        ctx.strokeStyle = dark ? "rgba(221, 240, 245, 0.32)" : "rgba(48, 68, 58, 0.3)"
        ctx.lineWidth = 1
        for (const x of [left, right]) {
            for (const y of [top + 8, top + height / 2, bottom - 8]) {
                ctx.beginPath()
                ctx.moveTo(x - (x === right ? 5 : 0), y)
                ctx.lineTo(x + (x === left ? 5 : 0), y)
                ctx.stroke()
            }
        }
        ctx.restore()
    }

    private drawSceneLabels(ctx: CanvasRenderingContext2D) {
        const origin = this.coordinateOrigin()
        const direction = origin?.facing === "left" ? -1 : 1
        const compact = this.metrics.scaleX * 24 < 480
        const occupied: FunctionWarsCoverRect[] = [...this.labelExclusions]
        for (const sceneUnit of this.scene.units) {
            const pending = this.pendingDestroyedUnits.has(sceneUnit.id)
            if (sceneUnit.alive === false && !pending && !this.destroyedUnits.has(sceneUnit.id)) continue
            const unit = pending ? this.pendingUnitSnapshots.get(sceneUnit.id) ?? sceneUnit : sceneUnit
            const point = worldToCanvas(unit, this.metrics)
            const { image, width, height, visualDrop, drawY, hpY } = this.unitSpriteGeometry(unit)
            const facingLeft = unit.facing === "left"
            const left = image ? -width / 2 : -width * (facingLeft ? 0.67 : 0.43)
            occupied.push({ x: point.x + left, y: point.y + visualDrop + drawY, width: image ? width : width * 1.1, height })
            if (!unit.falling && unit.hp != null && unit.maxHp && unit.maxHp > 0) {
                occupied.push({ x: point.x - width * 0.43, y: point.y + visualDrop + hpY, width: width * 0.86, height: 4 })
            }
        }
        let target = 0
        for (const unit of this.scene.units) {
            if (unit.alive === false) continue
            const point = worldToCanvas(unit, this.metrics)
            const own = unit.id === origin?.id
            const coordinates = origin ? ` (${this.formatCoordinate((unit.x - origin.x) * direction)},${this.formatCoordinate(unit.y - origin.y)})` : ""
            const label = own
                ? compact ? "炮口(0,0)" : "发射原点 (0,0)"
                : `${compact ? "" : "目标 "}${++target}${coordinates}`
            const geometry = this.unitSpriteGeometry(unit)
            this.drawLabel(ctx, label, point.x, point.y + geometry.visualDrop + geometry.labelY, own ? "#78cbb9" : "#edb07c", occupied)
        }
        for (const crate of this.scene.crates) {
            if (crate.type !== "relay" || crate.active === false) continue
            const point = worldToCanvas(crate, this.metrics)
            const coordinate = origin ? ` (${this.formatCoordinate((crate.x - origin.x) * direction)},${this.formatCoordinate(crate.y - origin.y)})` : ""
            this.drawLabel(ctx, `${compact ? "◇" : "中继"}${coordinate}`, point.x, point.y - 31, "#8bd2d2", occupied)
        }
        const { minX, maxX, minY, maxY } = FUNCTION_WARS_WORLD_BOUNDS
        const feedbackLabels = (this.scene.feedbackLabels ?? []).filter(({ x, y }) =>
            Number.isFinite(x) && Number.isFinite(y) && x >= minX && x <= maxX && y >= minY && y <= maxY,
        ).slice(0, 4)
        for (const feedback of feedbackLabels) {
            const point = worldToCanvas(feedback, this.metrics)
            occupied.push({ x: point.x - 5, y: point.y - 5, width: 10, height: 10 })
            ctx.save()
            ctx.fillStyle = "rgba(24, 42, 52, 0.94)"
            ctx.strokeStyle = feedback.preview ? "#8bd2d2" : "#edb07c"
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.arc(point.x, point.y, 4, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
            ctx.restore()
        }
        for (const feedback of feedbackLabels) {
            const point = worldToCanvas(feedback, this.metrics)
            this.drawLabel(ctx, `${feedback.preview ? "预览 · " : ""}${feedback.text}`, point.x, point.y - 28,
                feedback.preview ? "#8bd2d2" : "#edb07c", occupied)
        }
        for (const obstacle of this.scene.obstacles) {
            const width = (obstacle.shape === "circle" ? (obstacle.radius ?? 1) * 2 : obstacle.width ?? 1) * this.metrics.scaleX
            const height = (obstacle.shape === "circle" ? (obstacle.radius ?? 1) * 2 : obstacle.height ?? 1) * this.metrics.scaleY
            if (width < 45 || height < 30) continue
            const supportsUnit = obstacle.shape === "rect" && this.scene.units.some((unit) =>
                unit.alive !== false && Math.abs(unit.x - obstacle.x) <= (obstacle.width ?? 1) / 2 + 0.05
                && unit.y >= obstacle.y + (obstacle.height ?? 1) / 2
                && unit.y - obstacle.y - (obstacle.height ?? 1) / 2 <= 1.25)
            if (supportsUnit && (width < 90 || height < 40)) continue
            const material = obstacle.material ?? "earth"
            const name = material === "wood" ? "木材" : material === "metal" || material === "steel" ? "金属" : material === "rock" || material === "bedrock" ? "岩石" : "土层"
            const point = this.obstacleLabelAnchor(obstacle)
            if (!point) continue
            this.drawLabel(ctx, `${name} · ${obstacle.destructible ? "可破坏" : "不可破坏"}`, point.x, point.y - 23,
                obstacle.destructible ? "#f0bf70" : "#b8d4d7", occupied)
        }
        if (origin) {
            const point = worldToCanvas(origin, this.metrics)
            ctx.save()
            ctx.strokeStyle = normalizedTheme(this.scene.theme) === "space" ? "#bce7e4" : "#215a57"
            const muzzle = this.getUnitMuzzleCanvasPoint(origin.id)
            if (muzzle) {
                ctx.globalAlpha = 0.65
                ctx.setLineDash([2, 3])
                ctx.lineWidth = 1.2
                ctx.beginPath()
                ctx.moveTo(muzzle.x, muzzle.y)
                ctx.lineTo(point.x, point.y)
                ctx.stroke()
                ctx.setLineDash([])
                ctx.globalAlpha = 1
            }
            ctx.lineWidth = 1.8
            ctx.fillStyle = "#fafff6"
            ctx.beginPath()
            ctx.arc(point.x, point.y, 4, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(point.x - 6, point.y)
            ctx.lineTo(point.x + 6, point.y)
            ctx.moveTo(point.x, point.y - 6)
            ctx.lineTo(point.x, point.y + 6)
            ctx.stroke()
            ctx.restore()
        }
    }

    private formatCoordinate(value: number): string {
        return String(Math.round(value * 10) / 10)
    }

    private obstacleLabelAnchor(obstacle: FunctionWarsRenderObstacle): FunctionWarsPoint | null {
        if (this.labelAnchorTerrainKey !== this.terrainKey) {
            this.obstacleLabelAnchors.clear()
            this.labelAnchorTerrainKey = this.terrainKey
        }
        if (this.obstacleLabelAnchors.has(obstacle.id)) return this.obstacleLabelAnchors.get(obstacle.id) ?? null
        const width = obstacle.shape === "circle" ? (obstacle.radius ?? 1) * 2 : obstacle.width ?? 1
        const height = obstacle.shape === "circle" ? (obstacle.radius ?? 1) * 2 : obstacle.height ?? 1
        const craters = this.deferredCraters ?? this.scene.craters
        const groundTop = worldToCanvas({ x: 0, y: -5.25 }, this.metrics).y
        // Sample from the top down, preferring the centre of each surviving strip.
        for (let row = 0; row < 12; row += 1) {
            for (const column of [6, 5, 7, 4, 8, 3, 9, 2, 10, 1, 11, 0]) {
                const point = { x: obstacle.x + ((column + 0.5) / 12 - 0.5) * width,
                    y: obstacle.y + (0.5 - (row + 0.5) / 12) * height }
                if (obstacle.shape === "circle" && Math.hypot(point.x - obstacle.x, point.y - obstacle.y) > width / 2) continue
                const canvasPoint = worldToCanvas(point, this.metrics)
                const surfaceY = groundTop + Math.sin(canvasPoint.x * 0.033) * 4.2 + Math.sin(canvasPoint.x * 0.079 + 1.7) * 1.9 + Math.sin(canvasPoint.x * 0.157) * 0.8
                if ((obstacle.material ?? "earth") === "earth" && this.scene.groundVisible !== false && canvasPoint.y >= surfaceY) continue
                if (obstacle.destructible && craters.some((crater) => Math.hypot(point.x - crater.x, point.y - crater.y) <= crater.radius)) continue
                this.obstacleLabelAnchors.set(obstacle.id, canvasPoint)
                return canvasPoint
            }
        }
        this.obstacleLabelAnchors.set(obstacle.id, null)
        return null
    }

    private drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, occupied: FunctionWarsCoverRect[]) {
        ctx.save()
        ctx.font = "600 11px ui-sans-serif, system-ui, sans-serif"
        const labelWidth = ctx.measureText(text).width + 12
        const clampLeft = (value: number) => Math.max(3, Math.min(this.metrics.cssWidth - labelWidth - 3, value))
        const clampTop = (value: number) => Math.max(5, Math.min(this.metrics.cssHeight - 22, value))
        const initialLeft = clampLeft(x - labelWidth / 2)
        const initialTop = clampTop(y)
        // At most seven columns and nine rows: nearby blockers supply a few
        // horizontal exits when the usual vertical slots are obscured by HUDs.
        const nearby = occupied.filter((rect) => rect.y < initialTop + 18 + 88 && rect.y + rect.height > initialTop - 88)
            .sort((a, b) => Math.abs(a.x + a.width / 2 - x) - Math.abs(b.x + b.width / 2 - x)).slice(0, 3)
        const columns = [...new Set([initialLeft, ...nearby.flatMap((rect) => [clampLeft(rect.x - labelWidth - 6), clampLeft(rect.x + rect.width + 6)])])]
        let best: { left: number; top: number; distance: number } | null = null
        for (const left of columns) {
            for (const offset of [0, -22, 22, -44, 44, -66, 66, -88, 88]) {
                const top = clampTop(y + offset)
                const overlaps = occupied.some((rect) => left < rect.x + rect.width + 3 && left + labelWidth + 3 > rect.x
                    && top < rect.y + rect.height + 3 && top + 21 > rect.y)
                if (overlaps) continue
                const distance = (left - initialLeft) ** 2 + (top - initialTop) ** 2
                if (!best || distance < best.distance) best = { left, top, distance }
            }
        }
        // In an entirely obstructed viewport, avoid drawing text over a unit or HUD.
        if (!best) {
            ctx.restore()
            return
        }
        const { left, top } = best
        occupied.push({ x: left, y: top, width: labelWidth, height: 18 })
        if (Math.abs(top - y) > 20 || Math.abs(left - initialLeft) > 3) {
            ctx.strokeStyle = color
            ctx.globalAlpha = 0.4
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(x, y + 18)
            ctx.lineTo(Math.max(left + 4, Math.min(left + labelWidth - 4, x)), top + (top < y ? 18 : 0))
            ctx.stroke()
            ctx.globalAlpha = 1
        }
        ctx.fillStyle = "rgba(24, 42, 52, 0.94)"
        roundedRect(ctx, left, top, labelWidth, 18, 4)
        ctx.fill()
        ctx.fillStyle = color
        ctx.fillRect(left + 1, top + 4, 2, 10)
        ctx.fillStyle = "#f6f0dc"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(text, left + labelWidth / 2, top + 9)
        ctx.restore()
    }

    private drawImpactMarker(ctx: CanvasRenderingContext2D) {
        if (!this.scene.impact || this.pendingImpact) return
        const point = worldToCanvas(this.scene.impact, this.metrics)
        ctx.save()
        ctx.strokeStyle = normalizedTheme(this.scene.theme) === "space" ? "#ffcb94" : "#823e29"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(point.x, point.y, 5, 0, Math.PI * 2)
        for (const direction of [-1, 1]) {
            ctx.moveTo(point.x + direction * 8, point.y)
            ctx.lineTo(point.x + direction * 12, point.y)
            ctx.moveTo(point.x, point.y + direction * 8)
            ctx.lineTo(point.x, point.y + direction * 12)
        }
        ctx.stroke()
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
        const baseSurfaceY = (x: number) => groundTop
            + Math.sin(x * 0.033) * 4.2
            + Math.sin(x * 0.079 + 1.7) * 1.9
            + Math.sin(x * 0.157) * 0.8
        const groundBodies = terrainScene.groundVisible === false ? [] : terrainScene.obstacles.flatMap((obstacle) => {
            if ((obstacle.material ?? "earth") !== "earth") return []
            const center = worldToCanvas(obstacle, this.metrics)
            const halfWidth = (obstacle.shape === "circle" ? obstacle.radius ?? 1 : (obstacle.width ?? 1) / 2) * this.metrics.scaleX
            const halfHeight = (obstacle.shape === "circle" ? obstacle.radius ?? 1 : (obstacle.height ?? 1) / 2) * this.metrics.scaleY
            if (center.y - halfHeight >= baseSurfaceY(center.x) || center.y + halfHeight < baseSurfaceY(center.x)) return []
            return [{ obstacle, center, halfWidth, halfHeight }]
        })
        const soilTop = Math.min(groundTop, ...groundBodies.map(({ center, halfHeight }) => center.y - halfHeight))
        // The visible surface is the upper envelope. Grass never crosses an embedded body.
        const surfaceY = (x: number) => groundBodies.reduce((surface, body) => {
            const dx = x - body.center.x
            if (Math.abs(dx) > body.halfWidth) return surface
            const top = body.obstacle.shape === "circle"
                ? body.center.y - Math.sqrt(Math.max(0, body.halfWidth ** 2 - dx ** 2))
                : body.center.y - body.halfHeight
            return Math.min(surface, top)
        }, baseSurfaceY(x))
        const groundPath = () => {
            ctx.beginPath()
            ctx.moveTo(0, baseSurfaceY(0))
            for (let x = 0; x <= width; x += 12) ctx.lineTo(x, baseSurfaceY(x))
            ctx.lineTo(width, height)
            ctx.lineTo(0, height)
            ctx.closePath()
            // Every subpath uses the same winding: overlap is a union, never an XOR.
            for (const body of groundBodies) {
                if (body.obstacle.shape === "circle") {
                    ctx.moveTo(body.center.x + body.halfWidth, body.center.y)
                    ctx.arc(body.center.x, body.center.y, body.halfWidth, 0, Math.PI * 2)
                    ctx.closePath()
                } else ctx.rect(body.center.x - body.halfWidth, body.center.y - body.halfHeight, body.halfWidth * 2, body.halfHeight * 2)
            }
        }
        if (terrainScene.groundVisible !== false) {
            const groundGradient = ctx.createLinearGradient(0, soilTop, 0, height)
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
                groundGradient.addColorStop(0, "#c29d72")
                groundGradient.addColorStop(0.08, "#a98561")
                groundGradient.addColorStop(0.34, "#947352")
                groundGradient.addColorStop(1, "#80664f")
            }
            ctx.fillStyle = groundGradient
            groundPath()
            ctx.fill()

            ctx.save()
            groundPath()
            ctx.clip()
            if (theme === "space") {
                ctx.globalAlpha = 0.34
                for (let row = Math.floor((soilTop - groundTop - 18) / 22); groundTop + 18 + row * 22 < height; row += 1) {
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
                for (let row = Math.floor((soilTop - groundTop - 10) / 15); groundTop + 10 + row * 15 < height; row += 1) {
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
                for (let row = Math.floor((soilTop - groundTop - 10) / 18); groundTop + 10 + row * 18 < height; row += 1) {
                    const y = groundTop + 10 + row * 18
                    ctx.strokeStyle = row % 2 === 0 ? "#d4b28a" : "#6e513e"
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
            ctx.globalAlpha = 0.26
            for (let row = Math.floor((soilTop - groundTop) / 24); groundTop + row * 24 < height; row += 1) {
                for (let column = 0; column * 32 < width; column += 1) {
                    const seed = Math.abs(row * 47 + column * 31)
                    ctx.fillStyle = seed % 3 ? "#604b38" : "#ecd2aa"
                    ctx.fillRect(column * 32 + seed % 19, groundTop + row * 24 + seed % 17, 1.5 + seed % 3, 1.2)
                }
            }
            ctx.restore()

            ctx.save()
            groundPath()
            ctx.clip()
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
            for (let x = 0; x <= width; x += 2) {
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
            for (let x = 0; x <= width; x += 2) {
                ctx.lineTo(x, surfaceY(x) + 5)
            }
            ctx.stroke()
            ctx.restore()
        }

        // Preserve the entire uncarved soil union for immutable earth, including its
        // exposed slopes. Restoration is clipped to each immutable collider after cuts.
        let groundSnapshot: HTMLCanvasElement | undefined
        if (groundBodies.some(({ obstacle }) => !obstacle.destructible)) {
            groundSnapshot = document.createElement("canvas")
            groundSnapshot.width = this.metrics.pixelWidth
            groundSnapshot.height = this.metrics.pixelHeight
            groundSnapshot.getContext("2d")?.drawImage(this.terrainCanvas, 0, 0)
        }
        for (const obstacle of terrainScene.obstacles) {
            if (!obstacle.destructible) continue
            this.drawMaterialObstacle(ctx, obstacle)
        }

        for (const crater of terrainScene.craters) {
            const center = worldToCanvas(crater, this.metrics)
            const radius = crater.radius * this.metrics.scaleX
            ctx.save()
            ctx.globalCompositeOperation = "source-atop"
            const rim = ctx.createRadialGradient(center.x, center.y, radius * 0.7, center.x, center.y, radius * 1.14)
            rim.addColorStop(0, "rgba(27, 29, 28, 0.88)")
            rim.addColorStop(0.72, "rgba(45, 38, 33, 0.62)")
            rim.addColorStop(1, "rgba(255, 224, 165, 0.08)")
            ctx.fillStyle = rim
            ctx.beginPath()
            ctx.arc(center.x, center.y, radius * 1.14, 0, Math.PI * 2)
            ctx.fill()
            ctx.globalCompositeOperation = "destination-out"
            // The rim is translucent; the cut itself must erase every covered pixel.
            ctx.fillStyle = "#000"
            ctx.globalAlpha = 1
            ctx.beginPath()
            ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
        }
        // Paint immutable geometry after carving the destructible layer. Overlapping crater
        // circles form a union; neither an overlap nor a crater can punch through a solid.
        for (const obstacle of terrainScene.obstacles) {
            if (!obstacle.destructible) this.drawMaterialObstacle(ctx, obstacle, groundSnapshot)
        }
    }

    /** The same clipped material paint is used for every collider, in every theme. */
    private drawMaterialObstacle(ctx: CanvasRenderingContext2D, obstacle: FunctionWarsRenderObstacle, groundSnapshot?: HTMLCanvasElement) {
        const center = worldToCanvas(obstacle, this.metrics)
        const width = (obstacle.shape === "circle" ? (obstacle.radius ?? 1) * 2 : obstacle.width ?? 1) * this.metrics.scaleX
        const height = (obstacle.shape === "circle" ? (obstacle.radius ?? 1) * 2 : obstacle.height ?? 1) * this.metrics.scaleY
        if (width <= 0 || height <= 0) return
        const left = center.x - width / 2
        const top = center.y - height / 2
        const bottom = top + height
        const groundTop = worldToCanvas({ x: 0, y: -5.25 }, this.metrics).y
        const surfaceY = (x: number) => groundTop + Math.sin(x * 0.033) * 4.2 + Math.sin(x * 0.079 + 1.7) * 1.9 + Math.sin(x * 0.157) * 0.8
        const material = obstacle.material === "steel" ? "metal" : obstacle.material === "bedrock" ? "rock" : obstacle.material ?? "earth"
        const groundedEarth = material === "earth" && this.scene.groundVisible !== false
            && top < surfaceY(center.x) && bottom >= surfaceY(center.x)
        const palette = material === "wood" ? ["#e0ac68", "#ad733f", "#70452f"]
            : material === "rock" ? ["#b5ac98", "#898679", "#555951"]
                : material === "metal" ? ["#b1b9ad", "#7c8985", "#455650"]
                    : ["#c29d72", "#a98561", "#80664f"]
        const path = () => {
            ctx.beginPath()
            if (obstacle.shape === "circle") ctx.arc(center.x, center.y, width / 2, 0, Math.PI * 2)
            else ctx.rect(left, top, width, height)
        }
        ctx.save()
        path()
        ctx.clip()
        if (groundedEarth && groundSnapshot) {
            // Restore the whole immutable collider, including its exposed slope.
            ctx.drawImage(groundSnapshot, 0, 0, this.metrics.cssWidth, this.metrics.cssHeight)
        }
        if (!groundedEarth) {
            const gradient = ctx.createLinearGradient(0, top, 0, bottom)
            gradient.addColorStop(0, palette[0])
            gradient.addColorStop(0.5, palette[1])
            gradient.addColorStop(1, palette[2])
            ctx.fillStyle = gradient
            ctx.fillRect(left, top, width, height)
            ctx.strokeStyle = palette[2]
            ctx.lineWidth = 4
            path()
            ctx.stroke()
            ctx.lineWidth = 1.2
            if (material === "earth") {
                // World-aligned soil bands and deterministic grit stay fixed through crater updates.
                for (let y = groundTop + 10 - Math.ceil((groundTop + 10 - top) / 18) * 18; y < bottom; y += 18) {
                    ctx.strokeStyle = "rgba(91, 62, 43, 0.28)"
                    ctx.beginPath()
                    ctx.moveTo(left, y + Math.sin(left * 0.04) * 2.2)
                    for (let x = left; x <= left + width + 8; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.04) * 2.2)
                    ctx.stroke()
                }
                for (let i = 0; i < Math.min(70, width * height / 100); i += 1) {
                    const x = left + ((i * 37 + 11) % 101) / 101 * width
                    const y = top + ((i * 59 + 7) % 103) / 103 * height
                    ctx.fillStyle = i % 3 ? "rgba(85, 60, 40, 0.26)" : "rgba(244, 215, 164, 0.58)"
                    ctx.fillRect(x, y, 1.8 + i % 3, 1.2)
                }
                ctx.strokeStyle = "#d4b28a"
                ctx.lineWidth = 6
                ctx.save()
                // Surface vegetation belongs only to the exposed upper part of the body.
                ctx.beginPath(); ctx.rect(left, top, width, height * 0.42); ctx.clip()
                path(); ctx.stroke()
                ctx.restore()
            } else if (material === "wood") {
                const plankHeight = Math.max(10, Math.min(24, height / 3))
                for (let y = top + plankHeight; y < bottom; y += plankHeight) {
                    ctx.strokeStyle = "#70452f"; ctx.lineWidth = 2
                    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + width, y); ctx.stroke()
                }
                ctx.lineWidth = 1
                ctx.strokeStyle = "rgba(97, 56, 30, 0.43)"
                for (let y = top + 5; y < bottom; y += 7) {
                    ctx.beginPath(); ctx.moveTo(left + 3, y); ctx.bezierCurveTo(left + width * 0.3, y - 3, left + width * 0.6, y + 3, left + width - 3, y); ctx.stroke()
                }
                for (const x of [left + width * 0.22, left + width * 0.73]) {
                    ctx.beginPath(); ctx.ellipse(x, top + height * 0.38, Math.min(7, width * 0.1), Math.min(3, height * 0.08), 0, 0, Math.PI * 2); ctx.stroke()
                }
                if (height > 22 && width > 25) {
                    ctx.strokeStyle = "#70452f"; ctx.lineWidth = 9
                    ctx.beginPath(); ctx.moveTo(left + 4, bottom - 5); ctx.lineTo(left + width - 4, top + 5); ctx.stroke()
                    ctx.strokeStyle = "#d6a266"; ctx.lineWidth = 5; ctx.stroke()
                }
            } else if (material === "rock") {
                const facets = [[0, 0.12, 0.46, 0.02, 0.28, 0.48], [0.46, 0.02, 1, 0.22, 0.72, 0.62], [0, 0.7, 0.28, 0.48, 0.63, 1], [0.28, 0.48, 0.72, 0.62, 0.63, 1]]
                facets.forEach((points, index) => {
                    ctx.fillStyle = ["#c2b9a3", "#9c9b8b", "#686c60", "#777c6c"][index]
                    ctx.beginPath(); ctx.moveTo(left + points[0] * width, top + points[1] * height)
                    ctx.lineTo(left + points[2] * width, top + points[3] * height)
                    ctx.lineTo(left + points[4] * width, top + points[5] * height)
                    ctx.closePath(); ctx.fill()
                })
                ctx.strokeStyle = "#555951"; ctx.lineWidth = 1.5
                ctx.beginPath(); ctx.moveTo(left + width * 0.27, top + height * 0.18); ctx.lineTo(left + width * 0.35, top + height * 0.37); ctx.lineTo(left + width * 0.28, top + height * 0.48); ctx.stroke()
            } else {
                ctx.strokeStyle = "rgba(229, 230, 207, 0.38)"; ctx.lineWidth = 1
                for (let y = top + 4; y < bottom - 3; y += 5) {
                    ctx.beginPath(); ctx.moveTo(left + 3, y); ctx.lineTo(left + width - 3, y); ctx.stroke()
                }
                ctx.strokeStyle = "#455650"; ctx.lineWidth = 2
                for (let x = left + 34; x < left + width - 10; x += 42) {
                    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke()
                }
                ctx.fillStyle = "#3d4e48"
                for (const dx of [0.12, 0.88]) for (const dy of [0.18, 0.82]) {
                    ctx.beginPath(); ctx.arc(left + width * dx, top + height * dy, Math.min(2.4, height * 0.1), 0, Math.PI * 2); ctx.fill()
                }
            }
            // A contact shadow exists only where a rectangular base actually meets the soil.
            if (obstacle.shape === "rect" && this.scene.groundVisible !== false) {
                ctx.fillStyle = "rgba(56, 48, 35, 0.32)"
                for (let x = left; x < left + width; x += 2) {
                    if (Math.abs(bottom - surfaceY(x)) <= 2) ctx.fillRect(x, bottom - 2, Math.min(2, left + width - x), 2)
                }
            }
        }
        // Grounded soil already belongs to the union; add only its individual status stamp.
        // A shape-coded stamp remains legible on thin platforms and is independent of material.
        const size = Math.min(12, height * 0.65, width * 0.24)
        const markX = center.x
        const markY = groundedEarth ? Math.min(center.y, surfaceY(center.x) - size) : center.y
        ctx.save(); ctx.translate(markX, markY)
        ctx.strokeStyle = "#263a37"; ctx.lineWidth = Math.max(2, size * 0.25)
        ctx.fillStyle = obstacle.destructible ? "#f0bf70" : "#b8d4d7"
        if (obstacle.destructible) {
            ctx.beginPath(); ctx.moveTo(-size * 0.35, size * 0.42); ctx.lineTo(size * 0.2, -size * 0.22); ctx.stroke()
            ctx.save(); ctx.rotate(-0.7); ctx.fillRect(-size * 0.38, -size * 0.38, size * 0.76, size * 0.34); ctx.strokeRect(-size * 0.38, -size * 0.38, size * 0.76, size * 0.34); ctx.restore()
        } else {
            ctx.beginPath(); ctx.moveTo(0, -size * 0.48); ctx.lineTo(size * 0.4, -size * 0.28); ctx.lineTo(size * 0.3, size * 0.22); ctx.lineTo(0, size * 0.5); ctx.lineTo(-size * 0.3, size * 0.22); ctx.lineTo(-size * 0.4, -size * 0.28); ctx.closePath(); ctx.fill(); ctx.stroke()
        }
        ctx.restore()
        ctx.restore()
    }

    private drawSolidObstacles(ctx: CanvasRenderingContext2D, now: number) {
        if (!this.obstacleImpact || this.reduceMotion) return
        const elapsed = now - this.obstacleImpact.startedAt
        if (elapsed >= 260) return
        const obstacle = this.scene.obstacles.find(({ id }) => id === this.obstacleImpact?.obstacleId)
        if (!obstacle) return
        const center = worldToCanvas(obstacle, this.metrics)
        ctx.save()
        ctx.strokeStyle = `rgba(255, 238, 184, ${1 - elapsed / 260})`
        ctx.lineWidth = 3
        ctx.beginPath()
        if (obstacle.shape === "circle") ctx.arc(center.x, center.y, (obstacle.radius ?? 1) * this.metrics.scaleX, 0, Math.PI * 2)
        else ctx.rect(center.x - (obstacle.width ?? 1) * this.metrics.scaleX / 2, center.y - (obstacle.height ?? 1) * this.metrics.scaleY / 2, (obstacle.width ?? 1) * this.metrics.scaleX, (obstacle.height ?? 1) * this.metrics.scaleY)
        ctx.stroke()
        ctx.restore()
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
            ctx.fillStyle = "rgba(242, 201, 80, 0.14)"
            ctx.beginPath()
            ctx.arc(0, 0, size * 0.64, 0, Math.PI * 2)
            ctx.fill()
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
            const { image, width, height, visualDrop, drawY, muzzleX, muzzleY, hpY } = this.unitSpriteGeometry(unit)
            ctx.save()
            ctx.globalAlpha = alpha
            const fallDrop = falling ? Math.pow(popProgress, 1.55) * this.metrics.cssHeight * 0.58 : 0
            const shotAge = now - this.animationStartedAt
            const firing = !this.reduceMotion && this.animationKey !== null && shotAge >= 0 && shotAge < 180
                && this.scene.traces.some((trace) => trace.sourceUnitId === unit.id)
            const recoil = firing ? Math.sin(shotAge / 180 * Math.PI) * Math.min(4, width * 0.08) : 0
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
            // Keep the vehicle centered on its collision target and settled on its support.
            ctx.save()
            ctx.translate(-recoil, 0)
            if (image) {
                ctx.fillStyle = "rgba(20, 31, 34, 0.25)"
                ctx.beginPath()
                ctx.ellipse(-width * 0.04, height * 0.16, width * 0.4, height * 0.085, 0, 0, Math.PI * 2)
                ctx.fill()
                ctx.drawImage(image, -width / 2, drawY, width, height)
            } else {
                this.drawFallbackUnit(ctx, unit, width, height)
            }
            if (unit.hp != null && unit.maxHp && unit.hp < unit.maxHp * 0.6 && !pending) {
                ctx.strokeStyle = "rgba(38, 37, 34, 0.8)"
                ctx.lineWidth = 1.5
                ctx.beginPath()
                ctx.moveTo(-width * 0.12, -height * 0.58)
                ctx.lineTo(width * 0.03, -height * 0.36)
                ctx.lineTo(-width * 0.08, -height * 0.22)
                ctx.stroke()
            }
            ctx.restore()
            if (firing) {
                const muzzle = this.getUnitMuzzleCanvasPoint(unit.id)
                if (muzzle) {
                    const fade = 1 - shotAge / 180
                    ctx.fillStyle = `rgba(247, 226, 172, ${fade})`
                    ctx.beginPath()
                    ctx.ellipse(muzzleX + shotAge * 0.035, muzzleY - shotAge * 0.015, 3 + shotAge * 0.03, 2 + shotAge * 0.02, 0, 0, Math.PI * 2)
                    ctx.fill()
                }
            }
            if (unit.shield) {
                ctx.strokeStyle = "rgba(91, 202, 219, 0.82)"
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.ellipse(0, -height * 0.32, width * 0.7, height * 0.76, 0, 0, Math.PI * 2)
                ctx.stroke()
            }
            ctx.restore()

            if (!falling && unit.hp != null && unit.maxHp && unit.maxHp > 0) {
                const ratio = Math.max(0, Math.min(1, unit.hp / unit.maxHp))
                const barWidth = width * 0.86
                const barY = point.y + visualDrop + hpY
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

    private drawPreviewTraces(ctx: CanvasRenderingContext2D) {
        ctx.save()
        ctx.setLineDash([6, 5])
        for (const trace of this.scene.previewTraces ?? []) {
            ctx.lineWidth = 4.5
            ctx.strokeStyle = normalizedTheme(this.scene.theme) === "space" ? "rgba(19, 38, 52, 0.85)" : "rgba(249, 255, 247, 0.9)"
            this.strokeTrace(ctx, trace.points, 1)
            ctx.lineWidth = 2.2
            ctx.strokeStyle = normalizedTheme(this.scene.theme) === "space" ? "#8be4db" : "#176c72"
            this.strokeTrace(ctx, trace.points, 1)
        }
        ctx.restore()
    }

    private drawGhostTraces(ctx: CanvasRenderingContext2D) {
        ctx.save()
        ctx.setLineDash([5, 6])
        ctx.lineWidth = 1.4
        ctx.strokeStyle = normalizedTheme(this.scene.theme) === "space" ? "rgba(214, 235, 245, 0.48)" : "rgba(87, 97, 90, 0.45)"
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
            const weapon = trace.weapon ?? (trace.mirrored ? "mirror" : "standard")
            const palette = { standard: "#c27523", heavy: "#dd643b", drill: "#269c94", split: "#bd9030", mirror: "#a45ab7" }
            const color = trace.color ?? palette[weapon]
            ctx.save()
            ctx.lineJoin = "round"
            ctx.lineCap = "round"
            // A dark edge keeps the mathematical curve legible over every material.
            ctx.strokeStyle = normalizedTheme(this.scene.theme) === "space" ? "rgba(13, 28, 44, 0.85)" : "rgba(255, 251, 223, 0.92)"
            ctx.lineWidth = weapon === "heavy" ? 6 : 4.8
            this.strokeTrace(ctx, trace.points, localProgress)
            ctx.strokeStyle = color
            ctx.lineWidth = weapon === "heavy" ? 3.6 : 2.4
            if (weapon === "drill") ctx.setLineDash([7, 3])
            if (weapon === "mirror") ctx.setLineDash([9, 3, 2, 3])
            const head = this.strokeTrace(ctx, trace.points, localProgress)
            ctx.setLineDash([])
            const muzzle = trace.sourceUnitId ? this.getUnitMuzzleCanvasPoint(trace.sourceUnitId) : null
            const origin = trace.points[0] ? worldToCanvas(trace.points[0], this.metrics) : null
            if (muzzle && origin) {
                ctx.save()
                ctx.globalAlpha = 0.4
                ctx.lineWidth = 1.3
                ctx.beginPath()
                ctx.moveTo(muzzle.x, muzzle.y)
                ctx.lineTo(origin.x, origin.y)
                ctx.stroke()
                ctx.restore()
            }
            if (head && localProgress < 1) {
                const count = trace.points.length
                const headIndex = Math.min(count - 1, Math.max(1, Math.ceil(count * localProgress) - 1))
                const previous = worldToCanvas(trace.points[headIndex - 1], this.metrics)
                ctx.translate(head.x, head.y)
                ctx.rotate(Math.atan2(head.y - previous.y, head.x - previous.x))
                ctx.fillStyle = color
                ctx.strokeStyle = "#fff2c8"
                ctx.lineWidth = 1.3
                ctx.beginPath()
                if (weapon === "heavy") {
                    ctx.ellipse(0, 0, 6.5, 4.3, 0, 0, Math.PI * 2)
                } else if (weapon === "drill") {
                    ctx.moveTo(7, 0); ctx.lineTo(-4, -3.5); ctx.lineTo(-2, 0); ctx.lineTo(-4, 3.5); ctx.closePath()
                } else {
                    ctx.ellipse(0, 0, 4.5, 2.7, 0, 0, Math.PI * 2)
                }
                ctx.fill()
                ctx.stroke()
                if (weapon === "split") {
                    ctx.fillRect(-9, -5, 3, 2)
                    ctx.fillRect(-9, 3, 3, 2)
                }
                if (weapon === "mirror") {
                    ctx.strokeRect(-6, -5, 11, 10)
                }
                ctx.globalAlpha = 0.6
                ctx.fillStyle = "#fff1ac"
                ctx.beginPath()
                ctx.moveTo(-5, -2); ctx.lineTo(-14, 0); ctx.lineTo(-5, 2); ctx.closePath()
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
        const { visualDrop, muzzleX, muzzleY } = this.unitSpriteGeometry(unit)
        return { x: point.x + (unit.facing === "left" ? -1 : 1) * muzzleX, y: point.y + visualDrop + muzzleY }
    }

    private unitSpriteGeometry(unit: FunctionWarsRenderUnit) {
        const image = this.asset(unit.side === "enemy" ? unit.armored ? "unit:armored" : "unit:enemy" : "unit:player")
        const width = Math.max(unit.armored ? 48 : 42, this.metrics.scaleX * (unit.armored ? 1.7 : 1.48))
        const height = image ? width * image.naturalHeight / Math.max(1, image.naturalWidth) : width * 0.76
        const drawY = -height * 0.78
        // v2 art has 1/16 transparent vertical padding: its opaque foot is at 15/16 H.
        const footRatio = image ? 0.9375 - 0.78 : 0.11
        const visualDrop = getFunctionWarsUnitVisualDrop(unit, this.scene.obstacles, this.metrics, height, footRatio)
        const hpY = drawY - 7
        return {
            image, width, height, visualDrop, drawY, hpY,
            muzzleX: width * (image ? 0.44 : 0.67),
            muzzleY: image ? drawY + height * 0.27 : -height * 0.375,
            // Labels are 18px tall; keep them above both the bitmap and HP bar.
            labelY: Math.min(drawY, hpY) - 23,
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
            if (particle.kind === "spark") {
                ctx.strokeStyle = particle.color
                ctx.lineWidth = Math.max(1, particle.size * 0.4)
                ctx.beginPath()
                ctx.moveTo(point.x, point.y)
                ctx.lineTo(point.x - particle.vx * 0.7, point.y + particle.vy * 0.7)
                ctx.stroke()
            } else if (particle.kind === "chip") {
                ctx.fillRect(point.x, point.y, particle.size * 1.4, particle.size * 0.5)
            } else {
                ctx.beginPath()
                ctx.arc(point.x, point.y, particle.size * (0.55 + alpha * 0.45), 0, Math.PI * 2)
                ctx.fill()
            }
        }
        ctx.globalAlpha = 1
    }

}
