import { describe, expect, it } from "vitest"

import {
    compareRaceResults,
    decideRaceWinner,
    normalizeRaceResult,
    normalizeRaceSettings,
} from "@/lib/playground/race-online"

describe("race-online", () => {
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
