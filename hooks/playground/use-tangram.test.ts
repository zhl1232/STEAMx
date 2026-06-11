import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import {
    findSnapTarget,
    isTangramSolved,
    matchesTarget,
    PIECE_KIND,
    PIECE_SHAPES,
    TANGRAM_LEVELS,
    useTangram,
    type TangramPieceId,
    type TangramPieceState,
    type TangramTransform,
} from "./use-tangram"

vi.mock("@/lib/playground/storage", () => ({
    getPlaygroundItem: () => null,
    setPlaygroundItem: () => {},
}))

function piecesAtTargets(levelIndex: number): TangramPieceState[] {
    const level = TANGRAM_LEVELS[levelIndex]
    return (Object.keys(level.targets) as TangramPieceId[]).map((id) => ({
        id,
        ...level.targets[id],
    }))
}

describe("tangram figures", () => {
    it("ships every figure with all 7 pieces and 45° aligned rotations", () => {
        expect(TANGRAM_LEVELS.length).toBeGreaterThanOrEqual(4)
        for (const level of TANGRAM_LEVELS) {
            const ids = Object.keys(level.targets)
            expect(ids, level.id).toHaveLength(7)
            for (const transform of Object.values(level.targets)) {
                expect(Math.round(transform.rotation) % 45, level.id).toBe(0)
            }
        }
    })

    it("accepts exact target placements for every figure", () => {
        TANGRAM_LEVELS.forEach((level, index) => {
            expect(isTangramSolved(piecesAtTargets(index), level), level.id).toBe(true)
        })
    })

    it("keeps every silhouette inside the board area above the tray divider", () => {
        // 画布 viewBox 0 0 520 660，剪影区为分隔线（y=432）以上
        const transformPoint = (point: [number, number], transform: TangramTransform) => {
            const sx = transform.flipped ? -point[0] : point[0]
            const rad = (transform.rotation * Math.PI) / 180
            const cos = Math.cos(rad)
            const sin = Math.sin(rad)
            return {
                x: transform.x + sx * cos - point[1] * sin,
                y: transform.y + sx * sin + point[1] * cos,
            }
        }

        for (const level of TANGRAM_LEVELS) {
            for (const id of Object.keys(level.targets) as TangramPieceId[]) {
                const target = level.targets[id]
                for (const vertex of PIECE_SHAPES[PIECE_KIND[id]]) {
                    const { x, y } = transformPoint(vertex, target)
                    expect(x, `${level.id}/${id} x`).toBeGreaterThanOrEqual(0)
                    expect(x, `${level.id}/${id} x`).toBeLessThanOrEqual(520)
                    expect(y, `${level.id}/${id} y`).toBeGreaterThanOrEqual(0)
                    expect(y, `${level.id}/${id} y`).toBeLessThanOrEqual(432)
                }
            }
        }
    })

    it("accepts swapping the two equivalent large triangles", () => {
        const level = TANGRAM_LEVELS[0]
        const pieces = piecesAtTargets(0).map((piece) => {
            if (piece.id === "large-a") return { ...piece, ...level.targets["large-b"], id: "large-a" as const }
            if (piece.id === "large-b") return { ...piece, ...level.targets["large-a"], id: "large-b" as const }
            return piece
        })

        expect(isTangramSolved(pieces, level)).toBe(true)
    })

    it("treats square rotations as equivalent every 90 degrees", () => {
        const level = TANGRAM_LEVELS[0]
        const target = level.targets.square
        const piece: TangramPieceState = { id: "square", ...target, rotation: (target.rotation + 90) % 360 }

        expect(matchesTarget(piece, target)).toBe(true)
    })

    it("rejects displaced or flipped pieces", () => {
        const level = TANGRAM_LEVELS[0]
        const displaced = piecesAtTargets(0).map((piece) =>
            piece.id === "medium" ? { ...piece, x: piece.x + 80 } : piece,
        )
        const flipped = piecesAtTargets(0).map((piece) =>
            piece.id === "parallelogram" ? { ...piece, flipped: true } : piece,
        )

        expect(isTangramSolved(displaced, level)).toBe(false)
        expect(isTangramSolved(flipped, level)).toBe(false)
    })

    it("rotates a piece by 45 degrees through adjustPiece", () => {
        const { result } = renderHook(() => useTangram())

        act(() => {
            result.current.adjustPiece("medium", { rotateBy: 45 })
        })
        expect(result.current.pieces.find((piece) => piece.id === "medium")?.rotation).toBe(45)

        act(() => {
            result.current.adjustPiece("medium", { rotateBy: -45 })
        })
        expect(result.current.pieces.find((piece) => piece.id === "medium")?.rotation).toBe(0)
    })

    it("flips only the parallelogram through adjustPiece", () => {
        const { result } = renderHook(() => useTangram())

        act(() => {
            result.current.adjustPiece("parallelogram", { flip: true })
        })
        expect(result.current.pieces.find((piece) => piece.id === "parallelogram")?.flipped).toBe(true)

        act(() => {
            result.current.adjustPiece("square", { flip: true })
        })
        expect(result.current.pieces.find((piece) => piece.id === "square")?.flipped).toBe(false)
    })

    it("snaps a piece into its target when adjustPiece fixes the rotation nearby", () => {
        const { result } = renderHook(() => useTangram())
        const level = TANGRAM_LEVELS[0]
        const target = level.targets.medium

        act(() => {
            // 放到目标附近但角度差 45°
            result.current.updatePiece("medium", {
                x: target.x + 10,
                y: target.y - 10,
                rotation: (target.rotation + 315) % 360,
            })
        })
        act(() => {
            result.current.adjustPiece("medium", { rotateBy: 45 })
        })

        const medium = result.current.pieces.find((piece) => piece.id === "medium")
        expect(medium?.rotation).toBe(target.rotation % 360)
        expect(medium?.x).toBe(target.x)
        expect(medium?.y).toBe(target.y)
    })

    it("snaps a correctly rotated piece released near its target", () => {
        const level = TANGRAM_LEVELS[0]
        const target = level.targets.medium
        const piece: TangramPieceState = {
            id: "medium",
            x: target.x + 20,
            y: target.y - 15,
            rotation: target.rotation,
            flipped: false,
        }

        const snap = findSnapTarget(piece, [], level)
        expect(snap).not.toBeNull()
        expect(snap?.x).toBe(target.x)
        expect(snap?.y).toBe(target.y)

        const wrongRotation: TangramPieceState = { ...piece, rotation: target.rotation + 45 }
        expect(findSnapTarget(wrongRotation, [], level)).toBeNull()
    })
})
