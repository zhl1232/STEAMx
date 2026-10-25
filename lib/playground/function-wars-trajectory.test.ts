import { describe, expect, it } from "vitest"
import { parseFunctionExpression } from "./function-plotter"
import { buildFunctionWarsTrajectory, FUNCTION_WARS_FLIGHT_DISTANCE, getMeaningfulFunctionWarsUsage, validateFunctionWarsLaunch } from "./function-wars-trajectory"

function parsed(source: string) {
    const result = parseFunctionExpression(source)
    if (!result.ok) throw new Error(result.error.message)
    return result.parsed
}
const origin = { x: -10, y: 0 }

describe("bounded function wars trajectories", () => {
    it.each(["1000*(1-x/20)", "cos(x)", "1/x", "log(x)", "exp(1000)"])("rejects invalid launch %s", expression => {
        expect(validateFunctionWarsLaunch(parsed(expression))).toBeTypeOf("string")
        expect(buildFunctionWarsTrajectory({ parsed: parsed(expression), origin }).points).toEqual([])
    })
    it.each(["cos(x)-1", "exp(0.1x)-1", "log(x+1)", "sqrt(x)"])("accepts continuous anchored %s", expression => {
        const result = buildFunctionWarsTrajectory({ parsed: parsed(expression), origin })
        expect(result.error).toBeNull()
        expect(result.points[0]).toEqual(origin)
        expect(result.points.length).toBeGreaterThan(2)
    })
    it("truncates high arcs at the ceiling without re-entry", () => {
        const result = buildFunctionWarsTrajectory({ parsed: parsed("0.5x(20-x)"), origin })
        expect(result.termination).toBe("out_of_bounds")
        expect(result.points.at(-1)?.y).toBe(7)
        expect(result.points.at(-1)!.x).toBeLessThan(-9)
    })
    it.each(["6sin(70x)", "sin(50*pi*x)", "sin(100*pi*x)", "sin(100*x^2)", "sin(1000*x^3)"])("bounds oscillatory work and traveled distance for %s", expression => {
        const result = buildFunctionWarsTrajectory({ parsed: parsed(expression), origin })
        const length = result.points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x-result.points[i].x,p.y-result.points[i].y),0)
        expect(length).toBeLessThanOrEqual(FUNCTION_WARS_FLIGHT_DISTANCE + 1e-8)
        expect(result.points.at(-1)!.x).toBeLessThan(8)
        expect(["distance_limit", "sample_limit"]).toContain(result.termination)
    })
    it.each(["0.001sin(1000000x)+0.025x(20-x)", "0.000001cos(1000000x)-0.000001+0.025x(20-x)", "0.001sin(sin(1000000x))+0.025x(20-x)", "0.001sin(1000000x^2)+0.025x(20-x)"])("resolves phase independently of amplitude for %s", expression => {
        const result = buildFunctionWarsTrajectory({ parsed: parsed(expression), origin })
        expect(result.termination).toBe("sample_limit")
        expect(result.points.at(-1)!.x).toBeLessThan(-9)
        expect(result.points.length).toBeLessThanOrEqual(10001)
    })
    it.each(["sin(x)^2+cos(x)^2-1", "x+sin(x)^2+cos(x)^2-1", "sin(x)*sin(x)+x+cos(x)*cos(x)-1", "x+sin(2x)^2+cos(2x)^2+sin(x)^2+cos(x)^2-2"])("ignores constant trigonometric identity groups in %s", expression => {
        expect(getMeaningfulFunctionWarsUsage(parsed(expression)).functions).toEqual([])
    })
    it("stops when a real-domain branch ends without bridging the invalid interval", () => {
        const result = buildFunctionWarsTrajectory({parsed:parsed("sqrt(1-x)-1"),origin})
        expect(result.termination).toBe("domain_error")
        expect(result.points.at(-1)!.x).toBeLessThanOrEqual(-9)
        expect(result.points.every(point=>Number.isFinite(point.y))).toBe(true)
    })
    it("uses the same local x for right-to-left mirrored flight", () => {
        const left = buildFunctionWarsTrajectory({ parsed: parsed("0.2x"), origin })
        const right = buildFunctionWarsTrajectory({ parsed: parsed("0.2x"), origin: { x:10,y:0 }, direction:-1, yScale:-1 })
        expect(right.points).toEqual(left.points.map(point=>({x:-point.x,y:point.y === 0 ? 0 : -point.y})))
    })
    it.each(["0sin(x)", "sin(x)-sin(x)", "x+sin(1)", "sin(1)*x", "sin(x/x)*x", "sin(x-x+1)*x", "x+0.001sin(x)", "sin(x)^0"])("ignores decorative function usage in %s", expression => {
        expect(getMeaningfulFunctionWarsUsage(parsed(expression)).functions).toEqual([])
    })
    it("recognizes geometry even when zero ablation would make a denominator undefined", () => {
        expect(getMeaningfulFunctionWarsUsage(parsed("1/sin(x+1)-1/sin(1)")).functions).toEqual(["sin"])
        expect(getMeaningfulFunctionWarsUsage(parsed("sin(x+1)/sin(x+1)")).functions).toEqual([])
    })
    it("requires constants to affect geometry rather than occupy syntax", () => {
        expect(getMeaningfulFunctionWarsUsage(parsed("x+0*pi")).constants).toEqual([])
        expect(getMeaningfulFunctionWarsUsage(parsed("x+pi")).constants).toEqual([])
        expect(getMeaningfulFunctionWarsUsage(parsed("sin(pi*x/10)"))).toEqual({functions:["sin"],constants:["pi"]})
    })
})
