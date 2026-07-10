import { useCallback, useEffect, useRef, useState } from "react"
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"
import { usePlaygroundStatsLoader } from "@/lib/playground/use-playground-stats-loader"

export type TangramPieceId = "large-a" | "large-b" | "medium" | "small-a" | "small-b" | "square" | "parallelogram"
export type TangramShapeKind = "large" | "medium" | "small" | "square" | "parallelogram"

export type TangramTransform = { x: number; y: number; rotation: number; flipped?: boolean }
export type TangramPieceState = TangramTransform & { id: TangramPieceId }

export type TangramLevel = {
    id: string
    name: string
    hint: string
    targets: Record<TangramPieceId, TangramTransform>
}

export type TangramStats = {
    totalGames: number
    solvedLevels: string[]
    bestTimes: Record<string, number>
}

const STATS_KEY = "tangram_stats"
const EMPTY_STATS: TangramStats = { totalGames: 0, solvedLevels: [], bestTimes: {} }

export const PIECE_KIND: Record<TangramPieceId, TangramShapeKind> = {
    "large-a": "large",
    "large-b": "large",
    medium: "medium",
    "small-a": "small",
    "small-b": "small",
    square: "square",
    parallelogram: "parallelogram",
}

/**
 * 局部多边形（质心在原点，rotation 0 = 经典正方形拼法中的朝向）。
 * 基于边长 240 的标准七巧板分割推导。
 */
export const PIECE_SHAPES: Record<TangramShapeKind, Array<[number, number]>> = {
    large: [[-120, -40], [120, -40], [0, 80]],
    medium: [[40, -80], [40, 40], [-80, 40]],
    small: [[20, -60], [20, 60], [-40, 0]],
    square: [[0, -60], [60, 0], [0, 60], [-60, 0]],
    parallelogram: [[-90, 30], [-30, -30], [90, -30], [30, 30]],
}

/** 旋转对称性：square 每 90° 重合，parallelogram 每 180° 重合 */
const ROTATION_SYMMETRY: Record<TangramShapeKind, number> = {
    large: 360,
    medium: 360,
    small: 360,
    square: 90,
    parallelogram: 180,
}

/** 可互换的等价块分组（两块大三角、两块小三角可以互换位置） */
const EQUIVALENT_GROUPS: TangramPieceId[][] = [
    ["large-a", "large-b"],
    ["small-a", "small-b"],
    ["medium"],
    ["square"],
    ["parallelogram"],
]

// ── 拼法构造 ──────────────────────────────────────────────────────────
// 经典正方形（边长 240，左上角在原点）中 7 块的质心位置与朝向。
// 正方形被对角线分成两半：H1 = 两块大三角，H2 = 其余五块。
// 其他图形通过对这两半做旋转/平移组合得到，保证都是真实可拼的七巧板图形。

const SQUARE_PLACEMENTS: Record<TangramPieceId, TangramTransform> = {
    "large-a": { x: 120, y: 40, rotation: 0 },
    "large-b": { x: 40, y: 120, rotation: 270 },
    medium: { x: 200, y: 200, rotation: 0 },
    "small-a": { x: 220, y: 60, rotation: 0 },
    "small-b": { x: 120, y: 160, rotation: 90 },
    square: { x: 180, y: 120, rotation: 0 },
    parallelogram: { x: 90, y: 210, rotation: 0, flipped: false },
}

const H1_IDS: TangramPieceId[] = ["large-a", "large-b"]
const H2_IDS: TangramPieceId[] = ["medium", "small-a", "small-b", "square", "parallelogram"]

function normalizeRotation(rotation: number): number {
    return ((rotation % 360) + 360) % 360
}

/** 绕 pivot 顺时针旋转 deg（屏幕坐标系 y 向下） */
function rotateAbout(point: { x: number; y: number }, pivot: { x: number; y: number }, deg: number): { x: number; y: number } {
    const rad = (deg * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const dx = point.x - pivot.x
    const dy = point.y - pivot.y
    return {
        x: pivot.x + dx * cos - dy * sin,
        y: pivot.y + dx * sin + dy * cos,
    }
}

function transformPlacement(
    placement: TangramTransform,
    pivot: { x: number; y: number },
    deg: number,
    translate: { x: number; y: number },
): TangramTransform {
    const rotated = rotateAbout(placement, pivot, deg)
    return {
        x: rotated.x + translate.x,
        y: rotated.y + translate.y,
        rotation: normalizeRotation(placement.rotation + deg),
        flipped: placement.flipped ?? false,
    }
}

function buildTargets(
    spec: Array<{ ids: TangramPieceId[]; pivot: { x: number; y: number }; deg: number; translate: { x: number; y: number } }>,
    offset: { x: number; y: number },
): Record<TangramPieceId, TangramTransform> {
    const result = {} as Record<TangramPieceId, TangramTransform>
    for (const part of spec) {
        for (const id of part.ids) {
            const placed = transformPlacement(SQUARE_PLACEMENTS[id], part.pivot, part.deg, part.translate)
            result[id] = {
                x: placed.x + offset.x,
                y: placed.y + offset.y,
                rotation: placed.rotation,
                flipped: placed.flipped,
            }
        }
    }
    return result
}

const ORIGIN = { x: 0, y: 0 }
const SQUARE_CENTER = { x: 240, y: 240 }

/** 蘑菇屋的"屋身"：两块大三角沿对角线拼成边长 240/√2≈169.7 的正方形 */
function buildMushroomStem(offset: { x: number; y: number }): Record<"large-a" | "large-b", TangramTransform> {
    const half = 120 * Math.SQRT1_2 // ≈ 84.85，屋身正方形的半边长
    const top = 240 * Math.SQRT1_2 // ≈ 169.7，屋顶底边的 y
    const centroid = (points: Array<[number, number]>) => ({
        x: points.reduce((sum, point) => sum + point[0], 0) / points.length,
        y: points.reduce((sum, point) => sum + point[1], 0) / points.length,
    })
    // 屋身正方形四角（蘑菇局部坐标，屋顶尖点在原点）
    const tl: [number, number] = [-half, top]
    const tr: [number, number] = [half, top]
    const br: [number, number] = [half, top + 2 * half]
    const bl: [number, number] = [-half, top + 2 * half]
    const upper = centroid([tl, tr, br])
    const lower = centroid([tl, bl, br])
    return {
        "large-a": { x: upper.x + offset.x, y: upper.y + offset.y, rotation: 225, flipped: false },
        "large-b": { x: lower.x + offset.x, y: lower.y + offset.y, rotation: 45, flipped: false },
    }
}

export const TANGRAM_LEVELS: TangramLevel[] = [
    {
        id: "classic-square",
        name: "方块",
        hint: "经典七巧板正方形：先放两块大三角占住一半。",
        targets: buildTargets(
            [
                { ids: H1_IDS, pivot: ORIGIN, deg: 0, translate: ORIGIN },
                { ids: H2_IDS, pivot: ORIGIN, deg: 0, translate: ORIGIN },
            ],
            { x: 140, y: 40 },
        ),
    },
    {
        id: "mountain",
        name: "高山",
        hint: "底边 480 的大三角形：两半各占一侧山坡。",
        targets: buildTargets(
            [
                { ids: H1_IDS, pivot: ORIGIN, deg: 180, translate: { x: 240, y: 240 } },
                { ids: H2_IDS, pivot: SQUARE_CENTER, deg: 90, translate: ORIGIN },
            ],
            { x: 20, y: 80 },
        ),
    },
    {
        id: "slide",
        name: "滑梯",
        hint: "向右倾斜的平行四边形：注意斜边方向。",
        targets: buildTargets(
            [
                { ids: H1_IDS, pivot: ORIGIN, deg: 90, translate: { x: 240, y: 0 } },
                { ids: H2_IDS, pivot: SQUARE_CENTER, deg: 90, translate: ORIGIN },
            ],
            { x: 20, y: 80 },
        ),
    },
    {
        id: "mushroom",
        name: "蘑菇屋",
        hint: "五块拼成大屋顶，两块大三角组成屋身（需要 45° 旋转）。",
        targets: {
            // H2 绕正方形中心转 -135° 后，不动点 (240,240) 即屋顶尖点；
            // translate 把尖点移到 (260,40)，与下方屋身的尖点参数保持一致。
            ...buildTargets(
                [{ ids: H2_IDS, pivot: SQUARE_CENTER, deg: -135, translate: { x: 20, y: -200 } }],
                ORIGIN,
            ),
            ...buildMushroomStem({ x: 260, y: 40 }),
        } as Record<TangramPieceId, TangramTransform>,
    },
]

// ── 判定 ──────────────────────────────────────────────────────────────

export const POSITION_TOLERANCE = 24
const SNAP_DISTANCE = 32

export function matchesTarget(piece: TangramPieceState, target: TangramTransform, tolerance = POSITION_TOLERANCE): boolean {
    const distance = Math.hypot(piece.x - target.x, piece.y - target.y)
    if (distance > tolerance) return false
    const symmetry = ROTATION_SYMMETRY[PIECE_KIND[piece.id]]
    const delta = normalizeRotation(piece.rotation - target.rotation)
    if (delta % symmetry !== 0) return false
    return (piece.flipped ?? false) === (target.flipped ?? false)
}

/** 整体判定：等价块（两块大三角/两块小三角）可以互换目标位置 */
export function isTangramSolved(pieces: TangramPieceState[], level: TangramLevel, tolerance = POSITION_TOLERANCE): boolean {
    const pieceById = new Map(pieces.map((piece) => [piece.id, piece]))

    for (const group of EQUIVALENT_GROUPS) {
        const groupPieces = group.map((id) => pieceById.get(id))
        if (groupPieces.some((piece) => !piece)) return false
        const targets = group.map((id) => level.targets[id])

        if (group.length === 1) {
            if (!matchesTarget(groupPieces[0]!, targets[0], tolerance)) return false
            continue
        }

        const direct =
            matchesTarget(groupPieces[0]!, targets[0], tolerance) && matchesTarget(groupPieces[1]!, targets[1], tolerance)
        const swapped =
            matchesTarget(groupPieces[0]!, targets[1], tolerance) && matchesTarget(groupPieces[1]!, targets[0], tolerance)
        if (!direct && !swapped) return false
    }

    return true
}

/** 拖拽松手时：若姿态正确且接近某个同组空闲目标，则吸附到精确位置 */
export function findSnapTarget(
    piece: TangramPieceState,
    others: TangramPieceState[],
    level: TangramLevel,
): TangramTransform | null {
    const group = EQUIVALENT_GROUPS.find((ids) => ids.includes(piece.id)) ?? [piece.id]

    let best: TangramTransform | null = null
    let bestDistance = SNAP_DISTANCE

    for (const targetId of group) {
        const target = level.targets[targetId]
        const occupied = others.some(
            (other) => group.includes(other.id) && Math.hypot(other.x - target.x, other.y - target.y) < 2,
        )
        if (occupied) continue

        const candidate: TangramPieceState = { ...piece, x: target.x, y: target.y }
        if (!matchesTarget(candidate, target, 1)) continue

        const distance = Math.hypot(piece.x - target.x, piece.y - target.y)
        if (distance <= bestDistance) {
            best = target
            bestDistance = distance
        }
    }

    return best
}

// ── 持久化 ────────────────────────────────────────────────────────────

function loadStats(): TangramStats {
    const raw = getPlaygroundItem<Partial<TangramStats>>(STATS_KEY)
    if (!raw) return { ...EMPTY_STATS }
    return {
        totalGames: typeof raw.totalGames === "number" ? raw.totalGames : 0,
        solvedLevels: Array.isArray(raw.solvedLevels)
            ? raw.solvedLevels.filter((id): id is string => typeof id === "string")
            : [],
        bestTimes: raw.bestTimes && typeof raw.bestTimes === "object" ? raw.bestTimes : {},
    }
}

function saveStats(stats: TangramStats) {
    setPlaygroundItem(STATS_KEY, stats)
}

const TRAY_POSITIONS: Record<TangramPieceId, { x: number; y: number }> = {
    "large-a": { x: 140, y: 500 },
    "large-b": { x: 300, y: 500 },
    medium: { x: 430, y: 510 },
    "small-a": { x: 80, y: 600 },
    "small-b": { x: 180, y: 600 },
    square: { x: 300, y: 600 },
    parallelogram: { x: 430, y: 600 },
}

function initialPieces(): TangramPieceState[] {
    return (Object.keys(TRAY_POSITIONS) as TangramPieceId[]).map((id) => ({
        id,
        x: TRAY_POSITIONS[id].x,
        y: TRAY_POSITIONS[id].y,
        rotation: 0,
        flipped: false,
    }))
}

// ── React Hook ────────────────────────────────────────────────────────

export function useTangram() {
    const [levelIndex, setLevelIndex] = useState(0)
    const [pieces, setPieces] = useState<TangramPieceState[]>(() => initialPieces())
    const [selectedId, setSelectedId] = useState<TangramPieceId>("large-a")
    const [time, setTime] = useState(0)
    const [status, setStatus] = useState<"playing" | "solved">("playing")
    const [stats, setStats] = useState<TangramStats>(EMPTY_STATS)
    const solvedRecordedRef = useRef(false)
    const level = TANGRAM_LEVELS[levelIndex]

    usePlaygroundStatsLoader(() => setStats(loadStats()))

    useEffect(() => {
        if (status !== "playing") return
        const id = setInterval(() => setTime((value) => value + 1), 1000)
        return () => clearInterval(id)
    }, [status])

    const recordSolve = useCallback((solvedLevel: TangramLevel, seconds: number) => {
        if (solvedRecordedRef.current) return
        solvedRecordedRef.current = true
        setStatus("solved")
        setStats((prev) => {
            const solvedLevels = prev.solvedLevels.includes(solvedLevel.id)
                ? prev.solvedLevels
                : [...prev.solvedLevels, solvedLevel.id]
            const previousBest = prev.bestTimes[solvedLevel.id]
            const updated: TangramStats = {
                totalGames: prev.totalGames + 1,
                solvedLevels,
                bestTimes: {
                    ...prev.bestTimes,
                    [solvedLevel.id]: previousBest ? Math.min(previousBest, seconds) : seconds,
                },
            }
            saveStats(updated)
            return updated
        })
    }, [])

    const applyPieces = useCallback(
        (next: TangramPieceState[]) => {
            setPieces(next)
            if (status === "playing" && isTangramSolved(next, level)) {
                recordSolve(level, time)
            }
        },
        [level, recordSolve, status, time],
    )

    const updatePiece = useCallback(
        (id: TangramPieceId, patch: Partial<TangramTransform>) => {
            if (status === "solved") return
            applyPieces(pieces.map((piece) => (piece.id === id ? { ...piece, ...patch } : piece)))
        },
        [applyPieces, pieces, status],
    )

    /** 旋转/翻转拼块；若调整后姿态正确且靠近空闲目标会自动吸附 */
    const adjustPiece = useCallback(
        (id: TangramPieceId, options: { rotateBy?: number; flip?: boolean }) => {
            if (status === "solved") return
            const piece = pieces.find((item) => item.id === id)
            if (!piece) return
            if (options.flip && PIECE_KIND[id] !== "parallelogram") return
            const next: TangramPieceState = {
                ...piece,
                rotation: normalizeRotation(piece.rotation + (options.rotateBy ?? 0)),
                flipped: options.flip ? !piece.flipped : (piece.flipped ?? false),
            }
            const snap = findSnapTarget(next, pieces.filter((item) => item.id !== id), level)
            const finalPiece = snap ? { ...next, x: snap.x, y: snap.y } : next
            applyPieces(pieces.map((item) => (item.id === id ? finalPiece : item)))
        },
        [applyPieces, level, pieces, status],
    )

    const releasePiece = useCallback(
        (id: TangramPieceId) => {
            if (status === "solved") return
            const piece = pieces.find((item) => item.id === id)
            if (!piece) return
            const snap = findSnapTarget(piece, pieces.filter((item) => item.id !== id), level)
            if (!snap) return
            applyPieces(pieces.map((item) => (item.id === id ? { ...item, x: snap.x, y: snap.y } : item)))
        },
        [applyPieces, level, pieces, status],
    )

    const rotateSelected = useCallback(() => {
        adjustPiece(selectedId, { rotateBy: 45 })
    }, [adjustPiece, selectedId])

    const flipSelected = useCallback(() => {
        adjustPiece(selectedId, { flip: true })
    }, [adjustPiece, selectedId])

    const startLevel = useCallback((index: number) => {
        solvedRecordedRef.current = false
        setLevelIndex(Math.max(0, Math.min(TANGRAM_LEVELS.length - 1, index)))
        setPieces(initialPieces())
        setSelectedId("large-a")
        setTime(0)
        setStatus("playing")
    }, [])

    return {
        level,
        levelIndex,
        levelCount: TANGRAM_LEVELS.length,
        pieces,
        selectedId,
        time,
        status,
        stats,
        setSelectedId,
        updatePiece,
        adjustPiece,
        releasePiece,
        rotateSelected,
        flipSelected,
        startLevel,
    }
}
