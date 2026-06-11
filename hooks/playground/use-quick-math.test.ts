import { describe, expect, it } from "vitest"

import { generateQuestion } from "./use-quick-math"

describe("quick math question generation", () => {
    it("generates questions with correct answers", () => {
        for (let streak = 0; streak < 20; streak++) {
            const question = generateQuestion(streak)
            const [left, operator, right] = question.text.split(" ")
            const a = Number(left)
            const b = Number(right)
            const expected = operator === "+"
                ? a + b
                : operator === "-"
                    ? a - b
                    : a * b

            expect(question.answer).toBe(expected)
        }
    })

    it("increases level with streak", () => {
        expect(generateQuestion(0).level).toBe(1)
        expect(generateQuestion(10).level).toBeGreaterThanOrEqual(3)
    })
})
