import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'components/features/tutor/tutor-panel.module.css'), 'utf8')
const mobileCss = css.slice(css.indexOf('@media (max-width: 767px)'))

describe('mobile tutor sheet bottom spacing', () => {
  it('anchors the expanded panel to the visual viewport with only safe-area padding', () => {
    const panel = mobileCss.match(/\.panel\s*\{([^}]+)\}/)?.[1]
    expect(panel).toBeDefined()
    expect(panel).toMatch(/bottom:\s*var\(--tutor-viewport-bottom,\s*0px\)/)
    expect(panel).toMatch(/padding-bottom:\s*env\(safe-area-inset-bottom,\s*0px\)/)
    expect(panel).not.toContain('--tutor-sheet-collapsed-bottom')
    expect(mobileCss).not.toMatch(/padding-bottom:[^;]*--tutor-sheet-collapsed-bottom/)
  })

  it('reserves the page-bar inset exclusively for the collapsed bottom position', () => {
    const collapsed = mobileCss.match(/\.panel\[data-sheet-snap='collapsed'\]\s*\{([^}]+)\}/)?.[1]
    expect(collapsed).toMatch(/bottom:\s*var\(--tutor-sheet-collapsed-bottom,/)
    expect(collapsed).toMatch(/padding-bottom:\s*0\s*;/)
    expect(mobileCss.replace(/\.panel\[data-sheet-snap='collapsed'\]\s*\{[^}]+\}/, '')).not.toContain('--tutor-sheet-collapsed-bottom')
  })
})
