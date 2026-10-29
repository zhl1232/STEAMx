import { describe, expect, it } from "vitest";

import {
    buildOnlineDeck,
    getMemoryOnlineColumns,
    isMemoryOnlineTheme,
    memoryCardLabel,
    MEMORY_ONLINE_PAIR_COUNTS,
    getMemoryColumns,
    isMemoryDifficulty,
    isMemoryTheme,
    MEMORY_PAIRS,
    memorySymbolsFor,
    opponentRole,
} from "./memory-online";

import { MEMORY_LEVEL_THEMES } from "./memory-levels";

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
        expect(isMemoryTheme("toString")).toBe(false);
        expect(isMemoryTheme("__proto__")).toBe(false);
        expect(isMemoryTheme(123)).toBe(false);
        expect(isMemoryDifficulty("hard")).toBe(true);
        expect(isMemoryDifficulty("extreme")).toBe(false);
    });
});

describe("concept online decks", () => {
    it.each(MEMORY_LEVEL_THEMES.map((theme) => [theme.id] as const))("reuses the %s single-player pairs with opposite faces sharing an RPC key", (themeId) => {
        const theme = MEMORY_LEVEL_THEMES.find((item) => item.id === themeId)!;
        for (const [difficulty, count] of Object.entries(MEMORY_ONLINE_PAIR_COUNTS)) {
            const deck = buildOnlineDeck(themeId, difficulty as "easy" | "normal" | "hard");
            expect(deck).toHaveLength(count * 2);
            expect(new Set(deck.map((card) => card.id)).size).toBe(deck.length);
            for (const pair of theme.pairs.slice(0, count)) {
                const cards = deck.filter((card) => card.symbol === `${themeId}:${pair.key}`);
                expect(cards).toHaveLength(2);
                expect(cards.map((card) => card.face).sort()).toEqual(["def", "term"]);
                expect(cards.map(memoryCardLabel).sort()).toEqual([pair.term, pair.def].sort());
                expect(cards.every((card) => card.matched === null)).toBe(true);
            }
        }
    });

    it("uses four readable columns for concepts and preserves legacy room grids", () => {
        expect(getMemoryOnlineColumns("optics", "hard")).toBe(4);
        expect(getMemoryOnlineColumns("animals", "hard")).toBe(6);
        expect(memoryCardLabel({ id: "old", symbol: "🦊", matched: null })).toBe("🦊");
        expect(isMemoryOnlineTheme("animals")).toBe(false);
        expect(isMemoryOnlineTheme("toString")).toBe(false);
        expect(isMemoryOnlineTheme("mechanics")).toBe(true);
    });
});
