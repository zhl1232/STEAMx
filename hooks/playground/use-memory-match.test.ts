import { describe, expect, it } from "vitest"

import { createMemoryDeck, getMemoryColumns } from "./use-memory-match"

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
})
