import { describe, expect, it } from "vitest"

import {
    FUNCTION_EXPRESSION_MAX_DEPTH,
    FUNCTION_EXPRESSION_MAX_LENGTH,
    FUNCTION_EXPRESSION_MAX_TOKENS,
    evaluateFunction,
    parseFunctionExpression,
    plotFunction,
} from "./function-plotter"

function parse(source: string) {
    const result = parseFunctionExpression(source)
    expect(result.ok, result.ok ? undefined : result.error.message).toBe(true)
    if (!result.ok) throw new Error(result.error.message)
    return result.parsed
}

function valueAt(source: string, x: number): number {
    const result = evaluateFunction(parse(source), x)
    expect(result.ok, result.ok ? undefined : result.message).toBe(true)
    if (!result.ok) throw new Error(result.message)
    return result.value
}

describe("function expression parser", () => {
    it("evaluates the supported functions, constants, and unicode operators", () => {
        expect(valueAt("sin(pi / 2) + cos(0) + abs(−2)", 0)).toBeCloseTo(4)
        expect(valueAt("sqrt(9) + log(e) + exp(0)", 0)).toBeCloseTo(5)
        expect(valueAt("floor(1.8) + ceil(1.2) + round(1.6)", 0)).toBe(5)
        expect(valueAt("6 ÷ 2 × 3", 0)).toBe(9)
    })

    it("reports unique function and named-constant metadata", () => {
        const parsed = parse("sin(pi*x) + abs(sin(x)) + exp(e)")

        expect(parsed.functions).toEqual(["sin", "abs", "exp"])
        expect(parsed.constants).toEqual(["pi", "e"])
    })

    it("uses right-associated powers and conventional unary precedence", () => {
        expect(valueAt("2^3^2", 0)).toBe(512)
        expect(valueAt("-x^2", 3)).toBe(-9)
        expect(valueAt("2^-2", 0)).toBeCloseTo(0.25)
    })

    it("supports implicit multiplication without accepting arbitrary identifiers", () => {
        expect(valueAt("2x + 3sin(x) + 2(x + 1) + 2pi", 0)).toBeCloseTo(2 + 2 * Math.PI)

        const unknown = parseFunctionExpression("sinx + 1")
        expect(unknown).toMatchObject({ ok: false, error: { code: "unknown_identifier" } })

        const missingParentheses = parseFunctionExpression("sin x")
        expect(missingParentheses).toMatchObject({
            ok: false,
            error: { code: "function_parentheses_required" },
        })
    })

    it("returns positional errors for malformed or unsafe input", () => {
        expect(parseFunctionExpression("")).toMatchObject({ ok: false, error: { code: "empty_expression" } })
        expect(parseFunctionExpression("x;alert(1)")).toMatchObject({
            ok: false,
            error: { code: "invalid_character", position: 1 },
        })
        expect(parseFunctionExpression("(x + 1")).toMatchObject({
            ok: false,
            error: { code: "unexpected_token" },
        })
    })

    it("enforces input, token, and nesting limits", () => {
        expect(parseFunctionExpression("x".repeat(FUNCTION_EXPRESSION_MAX_LENGTH + 1))).toMatchObject({
            ok: false,
            error: { code: "input_too_long" },
        })

        const half = Math.ceil(FUNCTION_EXPRESSION_MAX_TOKENS / 2)
        const manyTokens = "(".repeat(half) + "x" + ")".repeat(half)
        expect(manyTokens.length).toBeLessThanOrEqual(FUNCTION_EXPRESSION_MAX_LENGTH)
        expect(parseFunctionExpression(manyTokens)).toMatchObject({
            ok: false,
            error: { code: "too_many_tokens" },
        })

        const nested = "(".repeat(FUNCTION_EXPRESSION_MAX_DEPTH + 2) + "x" + ")".repeat(FUNCTION_EXPRESSION_MAX_DEPTH + 2)
        expect(parseFunctionExpression(nested)).toMatchObject({
            ok: false,
            error: { code: "max_depth_exceeded" },
        })
    })
})

describe("function evaluation and plotting", () => {
    it("reports domain and finite-number failures without throwing", () => {
        expect(evaluateFunction(parse("1 / x"), 0)).toMatchObject({ ok: false, code: "division_by_zero" })
        expect(evaluateFunction(parse("sqrt(x)"), -1)).toMatchObject({ ok: false, code: "domain_error" })
        expect(evaluateFunction(parse("log(x)"), 0)).toMatchObject({ ok: false, code: "domain_error" })
        expect(evaluateFunction(parse("tan(pi / 2)"), 0)).toMatchObject({ ok: false, code: "domain_error" })
        expect(evaluateFunction(parse("exp(x)"), 1_000)).toMatchObject({ ok: false, code: "non_finite" })
    })

    it("returns stable samples for continuous curves", () => {
        const result = plotFunction(parse("0.5x + sin(x)"), {
            startX: 0,
            endX: 4,
            step: 0.1,
        })

        expect(result.termination.kind).toBe("completed")
        expect(result.samples[0]).toEqual({ x: 0, y: 0 })
        expect(result.samples.at(-1)?.x).toBe(4)
        expect(result.samples.length).toBe(41)
    })

    it("stops at reciprocal and tangent asymptotes", () => {
        const reciprocal = plotFunction(parse("1 / x"), {
            startX: -1,
            endX: 1,
            step: 0.1,
            maxAbsY: Number.MAX_VALUE,
        })
        expect(["domain_error", "discontinuity"]).toContain(reciprocal.termination.kind)
        expect(reciprocal.samples.at(-1)?.x ?? -1).toBeLessThan(0.1)

        const tangent = plotFunction(parse("tan(x)"), {
            startX: 1,
            endX: 2,
            step: 0.05,
            maxAbsY: Number.MAX_VALUE,
            discontinuityThreshold: 8,
        })
        expect(tangent.termination.kind).toBe("discontinuity")
        expect(tangent.termination.x).toBeGreaterThan(1.4)
        expect(tangent.termination.x).toBeLessThan(1.7)
    })

    it("detects poles and step jumps that occur between coarse samples", () => {
        const highFrequencyTangent = plotFunction(parse("tan(100x)"), {
            startX: 0,
            endX: 0.2,
            step: 0.04,
            maxAbsY: Number.MAX_VALUE,
            discontinuityThreshold: 10,
        })
        expect(highFrequencyTangent.termination.kind).toBe("discontinuity")
        expect(highFrequencyTangent.termination.x).toBeGreaterThan(0)
        expect(highFrequencyTangent.termination.x).toBeLessThan(0.04)

        const stepFunction = plotFunction(parse("10floor(x) - 5"), {
            startX: 0.9,
            endX: 1.1,
            step: 0.04,
            discontinuityThreshold: 10,
        })
        expect(stepFunction.termination.kind).toBe("discontinuity")
        expect(stepFunction.termination.x).toBeGreaterThan(0.98)
        expect(stepFunction.termination.x).toBeLessThan(1.02)
    })

    it("does not report cancelled step calls or constant tangent arguments as jumps", () => {
        const cancelledStep = plotFunction(parse("floor(x) - floor(x) + x"), {
            startX: 0.9,
            endX: 1.1,
            step: 0.04,
        })
        const constantTangent = plotFunction(parse("tan(1e20)"), {
            startX: 0,
            endX: 0.2,
            step: 0.04,
        })

        expect(cancelledStep.termination.kind).toBe("completed")
        expect(cancelledStep.samples.at(-1)?.y).toBeCloseTo(1.1)
        expect(constantTangent.termination.kind).toBe("completed")
        expect(constantTangent.samples.every((sample) => sample.y === constantTangent.samples[0].y)).toBe(true)
    })

    it("detects a translated reciprocal pole without rejecting a high smooth parabola", () => {
        const reciprocal = plotFunction(parse("1/(x-10)"), {
            startX: 0,
            endX: 22,
            step: 0.045,
            yOffset: -5.15,
            maxAbsY: 1_000_000,
            discontinuityThreshold: 10,
            maxSamples: 720,
        })
        const parabola = plotFunction(parse("-0.5x(x-20)"), {
            startX: 0,
            endX: 22,
            step: 0.045,
            yOffset: -5.15,
            maxAbsY: 1_000_000,
            discontinuityThreshold: 10,
            maxSamples: 720,
        })

        expect(reciprocal.termination.kind).toBe("discontinuity")
        expect(reciprocal.termination.x).toBeGreaterThan(9.9)
        expect(reciprocal.termination.x).toBeLessThan(10.1)
        expect(parabola.termination.kind).toBe("completed")
        expect(Math.max(...parabola.samples.map((sample) => sample.y))).toBeGreaterThan(32)
    })

    it("does not classify a steep continuous function as discontinuous", () => {
        const result = plotFunction(parse("1200x + 3"), {
            startX: 0,
            endX: 0.2,
            step: 0.04,
            maxAbsY: Number.MAX_VALUE,
            discontinuityThreshold: 10,
        })

        expect(result.termination.kind).toBe("completed")
        expect(result.samples.at(-1)?.y).toBeCloseTo(243)
    })

    it("stops when the configured sample budget is exhausted", () => {
        const result = plotFunction(parse("x"), {
            startX: 0,
            endX: 10,
            step: 0.01,
            maxSamples: 10,
        })

        expect(result.samples).toHaveLength(10)
        expect(result.termination.kind).toBe("sample_limit")
    })
})
