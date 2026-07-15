import { describe, expect, it } from "vitest"

import {
    compareRaceResults,
    decideRaceWinner,
    normalizeRaceResult,
    normalizeRaceSettings,
} from "@/lib/playground/race-online"

describe("race-online", () => {
    it("normalizes shared 24-point cards and compares by solve time", () => {
        const settings = normalizeRaceSettings("game24", {
            durationSeconds: 60,
            cardValues: [1, 3, 4, 6],
        })
        expect(settings).toEqual({ durationSeconds: 60, cardValues: [1, 3, 4, 6] })
        expect(
            compareRaceResults(
                "game24",
                { completed: true, cardValues: [1, 3, 4, 6], timeSeconds: 18 },
                { completed: true, cardValues: [1, 3, 4, 6], timeSeconds: 24 },
            ),
        ).toBe(-1)
        expect(
            compareRaceResults(
                "game24",
                { completed: false, cardValues: [1, 3, 4, 6], timeSeconds: 60 },
                { completed: false, cardValues: [1, 3, 4, 6], timeSeconds: 60 },
            ),
        ).toBe(0)
        expect(() =>
            normalizeRaceResult(
                "game24",
                { cardValues: [1, 2, 3, 4], timeSeconds: 20 },
                settings,
            ),
        ).toThrow(/cardValues/)
    })

    it("compares quick math by score then streak", () => {
        expect(
            compareRaceResults(
                "quickmath",
                { completed: true, score: 120, streak: 4 },
                { completed: true, score: 100, streak: 9 },
            ),
        ).toBe(-1)
        expect(
            compareRaceResults(
                "quickmath",
                { completed: true, score: 120, streak: 4 },
                { completed: true, score: 120, streak: 8 },
            ),
        ).toBe(1)
    })

    it("compares move races by moves then time", () => {
        expect(
            decideRaceWinner(
                "hanoi",
                { completed: true, diskCount: 4, moves: 15, timeSeconds: 120 },
                { completed: true, diskCount: 4, moves: 17, timeSeconds: 90 },
            ),
        ).toBe("host")
        expect(
            decideRaceWinner(
                "ballsort",
                { completed: true, levelId: "stage-1", moves: 20, timeSeconds: 120 },
                { completed: true, levelId: "stage-1", moves: 20, timeSeconds: 90 },
            ),
        ).toBe("guest")
    })

    it("normalizes settings and rejects result mismatches", () => {
        const settings = normalizeRaceSettings("hanoi", { diskCount: 5 })
        expect(settings).toEqual({ diskCount: 5 })
        expect(() =>
            normalizeRaceResult(
                "hanoi",
                { diskCount: 4, moves: 15, timeSeconds: 40 },
                settings,
            ),
        ).toThrow(/diskCount/)
    })

    it("normalizes shared fifteen puzzle boards and compares by moves then time", () => {
        const initialBoard = [1, 2, 3, 4, 5, 6, 0, 7, 8]
        const settings = normalizeRaceSettings("fifteen", { size: 3, initialBoard })
        expect(settings).toEqual({ size: 3, initialBoard })
        expect(
            decideRaceWinner(
                "fifteen",
                { completed: true, size: 3, initialBoard, moves: 2, timeSeconds: 10 },
                { completed: true, size: 3, initialBoard, moves: 3, timeSeconds: 8 },
            ),
        ).toBe("host")
        expect(
            decideRaceWinner(
                "fifteen",
                { completed: true, size: 3, initialBoard, moves: 2, timeSeconds: 12 },
                { completed: true, size: 3, initialBoard, moves: 2, timeSeconds: 8 },
            ),
        ).toBe("guest")
        expect(() =>
            normalizeRaceSettings("fifteen", {
                size: 3,
                initialBoard: [1, 2, 3, 4, 5, 6, 8, 7, 0],
            }),
        ).toThrow(/solvable/)
    })

    it("compares symmetry by stars, mistakes, moves and time", () => {
        expect(
            compareRaceResults(
                "symmetry",
                { completed: true, stars: 3, mistakes: 2, moves: 10, timeSeconds: 50 },
                { completed: true, stars: 2, mistakes: 0, moves: 8, timeSeconds: 20 },
            ),
        ).toBe(-1)
        expect(
            compareRaceResults(
                "symmetry",
                { completed: true, stars: 3, mistakes: 2, moves: 10, timeSeconds: 50 },
                { completed: true, stars: 3, mistakes: 1, moves: 12, timeSeconds: 80 },
            ),
        ).toBe(1)
    })
})
