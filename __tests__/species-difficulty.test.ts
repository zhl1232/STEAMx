import { describe, expect, test } from "vitest"
import {
    COMMON_BIRD_SLUGS,
    INSECT_BINGO_GRIDS,
    INSECT_S_CHALLENGES,
    MYTHIC_INSECT_SLUGS,
    RARE_BIRD_SLUGS,
    UNCOMMON_BIRD_SLUGS,
    buildInsectObservationProgress,
    countBirdsByDifficulty,
    getBirdDifficulty,
    getInsectRankLevel,
} from "@/lib/gamification/species-difficulty"

describe("bird difficulty map", () => {
    test("partitions 133 atlas birds into common / uncommon / rare without overlap", () => {
        const common = new Set<string>(COMMON_BIRD_SLUGS)
        const uncommon = new Set<string>(UNCOMMON_BIRD_SLUGS)
        const rare = new Set<string>(RARE_BIRD_SLUGS)

        expect(common.size).toBe(40)
        expect(uncommon.size).toBe(69)
        expect(rare.size).toBe(24)
        expect(common.size + uncommon.size + rare.size).toBe(133)
        expect([...common].some((slug) => uncommon.has(slug) || rare.has(slug))).toBe(false)
        expect([...uncommon].some((slug) => rare.has(slug))).toBe(false)
    })

    test("maps plan examples to the expected piles", () => {
        expect(getBirdDifficulty("pica-pica")).toBe("common")
        expect(getBirdDifficulty("passer-montanus")).toBe("common")
        expect(getBirdDifficulty("falco-tinnunculus")).toBe("uncommon")
        expect(getBirdDifficulty("terpsiphone-incei")).toBe("uncommon")
        expect(getBirdDifficulty("crossoptilon-mantchuricum")).toBe("rare")
        expect(getBirdDifficulty("aquila-chrysaetos")).toBe("rare")
        expect(getBirdDifficulty("bubo-bubo")).toBe("rare")
        expect(getBirdDifficulty("mallard")).toBe("common")
        expect(getBirdDifficulty("black-crowned-night-heron")).toBe("common")
        expect(getBirdDifficulty("great-egret")).toBe("uncommon")
    })

    test("counts unique slugs once per pile", () => {
        expect(countBirdsByDifficulty(["pica-pica", "pica-pica", "falco-tinnunculus", "otis-tarda"])).toEqual({
            common: 1,
            uncommon: 1,
            rare: 1,
        })
    })
})

describe("insect handbook catalogs", () => {
    test("has eight bingo grids of nine species and four S challenges", () => {
        expect(INSECT_BINGO_GRIDS).toHaveLength(8)
        expect(INSECT_BINGO_GRIDS.every((grid) => grid.species.length === 9)).toBe(true)
        expect(INSECT_S_CHALLENGES.map((item) => [item.id, item.species.length])).toEqual([
            ["stag", 8],
            ["saturniid", 8],
            ["carabid", 9],
            ["mythic", 7],
        ])
        expect(MYTHIC_INSECT_SLUGS).toHaveLength(7)
        expect(MYTHIC_INSECT_SLUGS).not.toContain("aeshna-crenata")
    })

    test("completing one D-rank grid reaches rank 1", () => {
        const urban = INSECT_BINGO_GRIDS.find((grid) => grid.id === "d_urban")!
        expect(getInsectRankLevel(new Set(urban.species.map((item) => item.slug)))).toBe(1)
    })

    test("completing a C-rank grid reaches rank 2 even without D", () => {
        const butterflies = INSECT_BINGO_GRIDS.find((grid) => grid.id === "c_butterflies")!
        expect(getInsectRankLevel(new Set(butterflies.species.map((item) => item.slug)))).toBe(2)
    })

    test("completing any S challenge reaches diamond rank", () => {
        const stag = INSECT_S_CHALLENGES.find((item) => item.id === "stag")!
        expect(getInsectRankLevel(new Set(stag.species.map((item) => item.slug)))).toBe(5)
    })

    test("completing the mythic set also reaches diamond and reveals the list", () => {
        const mythic = INSECT_S_CHALLENGES.find((item) => item.id === "mythic")!
        const progress = buildInsectObservationProgress(mythic.species.map((item) => item.slug))
        expect(progress.rankLevel).toBe(5)
        expect(progress.diamondUnlocked).toBe(true)
        expect(progress.mythicRevealed).toBe(true)
        expect(progress.mythicObservedCount).toBe(7)
    })

    test("one mythic species reveals the list without unlocking diamond", () => {
        const progress = buildInsectObservationProgress(["asiagomphus-hesperius"])
        expect(progress.diamondUnlocked).toBe(false)
        expect(progress.mythicRevealed).toBe(true)
        expect(progress.mythicObservedCount).toBe(1)
        expect(progress.rankLevel).toBe(0)
    })

    test("partial grids stay incomplete", () => {
        const urban = INSECT_BINGO_GRIDS.find((grid) => grid.id === "d_urban")!
        const progress = buildInsectObservationProgress(urban.species.slice(0, 8).map((item) => item.slug))
        const urbanProgress = progress.grids.find((grid) => grid.id === "d_urban")!
        expect(urbanProgress.complete).toBe(false)
        expect(urbanProgress.found).toBe(8)
        expect(progress.rankLevel).toBe(0)
    })
})
