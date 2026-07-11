import { describe, expect, it } from 'vitest'

import { GOMOKU_TUTOR_FACTS, shouldInjectGomokuFacts } from '@/lib/ai/tutor/gomoku-facts'

describe('shouldInjectGomokuFacts', () => {
  it('injects on the playground surface', () => {
    expect(shouldInjectGomokuFacts({ surface: 'playground' })).toBe(true)
  })

  it('injects for gomoku playground lessons and 五子棋 courses', () => {
    expect(shouldInjectGomokuFacts({ lessonGameKey: 'gomoku' })).toBe(true)
    expect(shouldInjectGomokuFacts({ courseTitle: '五子棋博弈论入门' })).toBe(true)
  })

  it('skips unrelated courses', () => {
    expect(shouldInjectGomokuFacts({ courseTitle: 'Scratch 入门', lessonGameKey: 'minesweeper' })).toBe(
      false,
    )
  })
})

describe('GOMOKU_TUTOR_FACTS', () => {
  it('states the proven black win, freestyle rules, and existing course', () => {
    expect(GOMOKU_TUTOR_FACTS).toContain('先手（黑棋）在双方完美对弈下必胜')
    expect(GOMOKU_TUTOR_FACTS).toContain('已有数学证明')
    expect(GOMOKU_TUTOR_FACTS).toContain('不要声称「尚未证明」')
    expect(GOMOKU_TUTOR_FACTS).toContain('自由五子棋（无禁手）')
    expect(GOMOKU_TUTOR_FACTS).toContain('《五子棋博弈论入门》')
    expect(GOMOKU_TUTOR_FACTS).toContain('不要说站内没有五子棋课程')
  })
})

describe('formatGomokuCourseFact', () => {
  it('appends a clickable course tag when an id is known', async () => {
    const { formatGomokuCourseFact } = await import('@/lib/ai/tutor/gomoku-facts')
    expect(formatGomokuCourseFact(42)).toContain('[course:42|五子棋博弈论入门]')
    expect(formatGomokuCourseFact(null)).toBe(GOMOKU_TUTOR_FACTS)
  })
})
