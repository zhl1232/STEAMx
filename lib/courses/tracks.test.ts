import { describe, expect, it } from 'vitest'

import { getLessonTrackLabel } from './tracks'

describe('getLessonTrackLabel', () => {
  it('maps known course lesson tracks to display labels', () => {
    expect(getLessonTrackLabel({ track: 'foundation' })).toBe('基础必学')
    expect(getLessonTrackLabel({ track: 'tactics' })).toBe('战术进阶')
    expect(getLessonTrackLabel({ track: 'ai' })).toBe('AI 原理')
    expect(getLessonTrackLabel({ track: 'review' })).toBe('复盘训练')
  })

  it('prefers explicit levelLabel overrides', () => {
    expect(getLessonTrackLabel({ track: 'foundation', levelLabel: '选学挑战' })).toBe('选学挑战')
  })

  it('returns null when no track metadata exists', () => {
    expect(getLessonTrackLabel({})).toBeNull()
    expect(getLessonTrackLabel(null)).toBeNull()
  })
})
