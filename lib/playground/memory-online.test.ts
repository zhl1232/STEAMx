import { describe, expect, it } from "vitest";

import {
    buildOnlineDeck,
    getMemoryColumns,
    isMemoryDifficulty,
    isMemoryTheme,
    MEMORY_PAIRS,
    memorySymbolsFor,
    opponentRole,
} from "./memory-online";

describe("memory-online shared helpers", () => {
    it("builds a shuffled deck with two of each symbol and null matched", () => {
        const deck = buildOnlineDeck("animals", "easy");
        expect(deck).toHaveLength(MEMORY_PAIRS.easy * 2);

        const bySymbol = new Map<string, number>();
        for (const card of deck) {
            expect(card.matched).toBeNull();
            expect(card.id).toMatch(/^animals-\d+-[ab]$/);
            bySymbol.set(card.symbol, (bySymbol.get(card.symbol) ?? 0) + 1);
        }
        // 每个符号恰好两张
        for (const count of bySymbol.values()) {
            expect(count).toBe(2);
        }
        // 符号种数 = 对数
        expect(bySymbol.size).toBe(MEMORY_PAIRS.easy);
    });

    it("scales deck size by difficulty", () => {
        expect(buildOnlineDeck("space", "easy")).toHaveLength(16);
        expect(buildOnlineDeck("space", "normal")).toHaveLength(20);
        expect(buildOnlineDeck("space", "hard")).toHaveLength(36);
    });

    it("gives every card a unique id", () => {
        const deck = buildOnlineDeck("food", "hard");
        const ids = new Set(deck.map((c) => c.id));
        expect(ids.size).toBe(deck.length);
    });

    it("maps difficulty to grid columns", () => {
        expect(getMemoryColumns("easy")).toBe(4);
        expect(getMemoryColumns("normal")).toBe(5);
        expect(getMemoryColumns("hard")).toBe(6);
    });

    it("derives symbols for a theme/difficulty from the shared table", () => {
        expect(memorySymbolsFor("nature", "easy")).toHaveLength(MEMORY_PAIRS.easy);
    });

    it("flips role with opponentRole", () => {
        expect(opponentRole("host")).toBe("guest");
        expect(opponentRole("guest")).toBe("host");
    });

    it("guards theme and difficulty inputs", () => {
        expect(isMemoryTheme("animals")).toBe(true);
        expect(isMemoryTheme("bogus")).toBe(false);
        expect(isMemoryTheme(123)).toBe(false);
        expect(isMemoryDifficulty("hard")).toBe(true);
        expect(isMemoryDifficulty("extreme")).toBe(false);
    });
});
