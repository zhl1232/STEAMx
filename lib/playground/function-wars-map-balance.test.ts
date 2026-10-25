import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"

import {
    buildFunctionWarsOnlineMap,
    createFunctionWarsInitialInventory,
    FUNCTION_WARS_DEFAULT_MAP_ID,
    type FunctionWarsRole,
} from "./function-wars-online"
import { simulateFunctionWarsOnlineShot } from "./function-wars-simulation"

function shoot(seed: number, expression: string, role: FunctionWarsRole = "host") {
    return simulateFunctionWarsOnlineShot({
        expression,
        role,
        weapon: "standard",
        map: buildFunctionWarsOnlineMap(seed),
        crates: [],
        craters: [],
        inventory: createFunctionWarsInitialInventory()[role],
    })
}

describe("Function Wars versioned map balance", () => {
    it("preserves the legacy seed geometry and scheduled supplies for existing rooms", () => {
        const legacy = buildFunctionWarsOnlineMap(42, "symmetric-canyon")
        // Captured before introducing V2; changing existing seeds changes active/replayed matches.
        expect(createHash("sha256").update(JSON.stringify(legacy)).digest("hex"))
            .toBe("605bf623a38a15472075b1cdb20de0e467389c4205220bff961711120f0a9799")
        expect(FUNCTION_WARS_DEFAULT_MAP_ID).toBe("symmetric-canyon-v2")
    })

    it("requires adapting the flight path while leaving every sampled map solvable for both sides", () => {
        let lowWins = 0
        let highWins = 0
        for (let seed = 0; seed < 32; seed++) {
            const low = shoot(seed, "0.025*x*(20-x)").summary.damage?.amount ?? 0
            const high = shoot(seed, "0.095*x*(20-x)").summary.damage?.amount ?? 0
            expect([low, high].sort(), `seed ${seed} should have one clear passage`).toEqual([0, 50])
            expect(shoot(seed, "0.025*x*(20-x)", "guest").summary.damage?.amount ?? 0).toBe(low)
            expect(shoot(seed, "0.095*x*(20-x)", "guest").summary.damage?.amount ?? 0).toBe(high)
            if (low) lowWins++
            if (high) highWins++
        }
        expect(lowWins).toBeGreaterThan(0)
        expect(highWins).toBeGreaterThan(0)
    })

    it("blocks offscreen spawning and the old high-sky bypass on either side", () => {
        for (const role of ["host", "guest"] as const) {
            for (const seed of [0, 1, 7, 42, 99]) {
                const sky = shoot(seed, "0.5*x*(20-x)", role)
                expect(sky.summary.damage ?? null).toBeNull()
                expect(sky.traces.flatMap(trace => trace.points).every(point => point.y <= 7 && point.y >= -7)).toBe(true)
                const displaced = shoot(seed, "1000*(1-x/20)", role)
                expect(displaced.error).toContain("f(0)=0")
                expect(displaced.traces).toEqual([])
            }
        }
    })
})
