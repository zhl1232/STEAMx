import { describe, expect, it } from 'vitest'

import { TUTOR_TOOL_NAMES } from '@/lib/ai/tutor/tool-calls'

describe('TUTOR_TOOL_NAMES', () => {
  it('lists the frontend tutor tools that can be emitted by the planner', () => {
    expect(TUTOR_TOOL_NAMES).toEqual([
      'pbl.focus_current_stage',
      'course.focus_lesson_step',
      'course.highlight_scratch_blocks',
      'playground.hint_minesweeper',
    ])
  })
})
