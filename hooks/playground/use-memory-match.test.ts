import { describe, expect, it } from "vitest"

import {
    createMemoryDeck,
    getMemoryColumns,
    getMemoryThemeSymbols,
    MEMORY_THEMES,
    type MemoryTheme,
} from "./use-memory-match"

describe("memory match setup", () => {
    it("creates pairs for the selected difficulty", () => {
        const deck = createMemoryDeck("easy")
        const counts = new Map<string, number>()
        for (const card of deck) {
            counts.set(card.symbol, (counts.get(card.symbol) ?? 0) + 1)
        }

        expect(deck).toHaveLength(16)
        expect([...counts.values()].every((count) => count === 2)).toBe(true)
    })

    it("uses stable column counts by difficulty", () => {
        expect(getMemoryColumns("easy")).toBe(4)
        expect(getMemoryColumns("normal")).toBe(5)
        expect(getMemoryColumns("hard")).toBe(6)
    })

    it("keeps each theme pack unique and large enough for hard mode", () => {
        for (const theme of MEMORY_THEMES.map((item) => item.key) as MemoryTheme[]) {
            const symbols = getMemoryThemeSymbols(theme)
            expect(symbols).toHaveLength(18)
            expect(new Set(symbols).size).toBe(18)

            const hardDeck = createMemoryDeck("hard", theme)
            expect(hardDeck).toHaveLength(36)
            expect(new Set(hardDeck.map((card) => card.symbol)).size).toBe(18)
        }
    })
})
