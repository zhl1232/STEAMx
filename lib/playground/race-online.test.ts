import { describe, expect, it } from "vitest"

import {
    compareRaceResults,
    isRaceGameKey,
    decideRaceWinner,
    normalizeRaceResult,
    normalizeRaceSettings,
} from "@/lib/playground/race-online"

describe("race-online", () => {
    it.each(["quickmath", "fifteen", "2048"])("rejects retired race key %s", (key) => {
        expect(isRaceGameKey(key)).toBe(false)
    })
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
                "hanoi",
                { completed: true, diskCount: 4, moves: 15, timeSeconds: 120 },
                { completed: true, diskCount: 4, moves: 15, timeSeconds: 90 },
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

})
