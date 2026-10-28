import { describe, expect, it } from "vitest"

import {
    createMemoryDeck,
    getMemoryColumns,
    MEMORY_CONCEPT_OPTIONS,
    type MemoryConceptPack,
} from "./use-memory-match"
import { MEMORY_CONCEPT_PACKS, memoryConceptsFor } from "@/lib/playground/memory-online"

describe("memory match concept setup", () => {
    it("creates term/definition pairs for the selected difficulty", () => {
        const deck = createMemoryDeck("easy", "physics")
        const counts = new Map<string, number>()
        for (const card of deck) {
            counts.set(card.symbol, (counts.get(card.symbol) ?? 0) + 1)
        }

        expect(deck).toHaveLength(16)
        expect([...counts.values()].every((count) => count === 2)).toBe(true)
        expect(deck.filter((card) => card.face === "term")).toHaveLength(8)
        expect(deck.filter((card) => card.face === "def")).toHaveLength(8)
    })

    it("uses stable column counts by difficulty", () => {
        expect(getMemoryColumns("easy")).toBe(4)
        expect(getMemoryColumns("normal")).toBe(5)
        expect(getMemoryColumns("hard")).toBe(6)
    })

    it("keeps each concept pack unique and large enough for hard mode", () => {
        for (const pack of MEMORY_CONCEPT_OPTIONS.map((item) => item.key) as MemoryConceptPack[]) {
            const pairs = MEMORY_CONCEPT_PACKS[pack]
            expect(pairs.length).toBeGreaterThanOrEqual(18)
            expect(new Set(pairs.map((p) => p.key)).size).toBe(pairs.length)

            const hardDeck = createMemoryDeck("hard", pack)
            expect(hardDeck).toHaveLength(36)
            expect(new Set(hardDeck.map((card) => card.symbol)).size).toBe(18)
            expect(memoryConceptsFor(pack, "hard")).toHaveLength(18)
        }
    })
})
