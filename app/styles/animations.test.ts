import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('route transition styles', () => {
    it('never retains the animation end state on the page wrapper', () => {
        const css = readFileSync('app/styles/animations.css', 'utf8')
        const rules = [...css.matchAll(/\.route-transition-enter\s*\{([^}]+)\}/g)]
        expect(rules.length).toBeGreaterThan(0)

        const declarations = rules.flatMap((rule) =>
            [...rule[1].matchAll(/\banimation(?:-fill-mode)?\s*:\s*([^;]+);/g)]
                .map((declaration) => declaration[1]),
        )
        expect(declarations.some((value) => /\broute-enter\b/.test(value))).toBe(true)
        for (const value of declarations) {
            expect(value).not.toMatch(/\b(?:forwards|both)\b/)
        }
    })
})
