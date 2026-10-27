import { describe, expect, it } from "vitest"
import {
    DENSITY_PUZZLES, LEVER_PUZZLES, blockMass, densestBlock, isSortedByDensity,
    leverSolvable, leverTilt, leverTorque, weighBlocks,
} from "./balance-physics"

describe("lever", () => {
    it("every puzzle is solvable within its weight budget", () => {
        for (const p of LEVER_PUZZLES) expect(leverSolvable(p), p.id).toBe(true)
    })
    it("computes torque and tilt direction", () => {
        expect(leverTorque({ 2: 3, 4: 1 })).toBe(10)
        expect(leverTilt(6, 6)).toBe(0)
        expect(leverTilt(8, 2)).toBeLessThan(0)
        expect(leverTilt(1, 20)).toBe(14)
    })
})

describe("density", () => {
    it("same-mass puzzles balance, same-volume puzzles differ", () => {
        for (const p of DENSITY_PUZZLES) {
            const [a, b] = p.blocks
            if (p.kind === "same-mass") expect(weighBlocks(a, b)).toBe("equal")
            else expect(weighBlocks(a, b)).not.toBe("equal")
        }
    })
    it("finds densest and checks sort order", () => {
        const p = DENSITY_PUZZLES[1]
        expect(densestBlock(p.blocks).material).toBe("copper")
        expect(isSortedByDensity(p.blocks)).toBe(false)
        expect(isSortedByDensity([...p.blocks].sort((x, y) => blockMass(x) - blockMass(y)))).toBe(true)
    })
})
