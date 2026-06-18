import { describe, expect, it } from 'vitest'

import { normalizeStageCoachActionResult } from '@/lib/pbl/stage-coach-actions'

describe('normalizeStageCoachActionResult', () => {
  it('keeps bounded structured coach output', () => {
    const result = normalizeStageCoachActionResult({
      action: 'breakdown',
      payload: {
        action: 'breakdown',
        title: '拆一下问题',
        bullets: [
          '先确认谁会使用这个空间？',
          '记录中午最晒的位置在哪里？',
          '比较两个材料的遮阳效果。',
          '这一条会保留',
          '这一条会被截掉',
        ],
        followUp: '先回答第一个问题。',
        generatedAt: '2026-06-18T08:00:00.000Z',
      },
    })

    expect(result).toEqual({
      action: 'breakdown',
      title: '拆一下问题',
      bullets: [
        '先确认谁会使用这个空间？',
        '记录中午最晒的位置在哪里？',
        '比较两个材料的遮阳效果。',
        '这一条会保留',
      ],
      followUp: '先回答第一个问题。',
      generatedAt: '2026-06-18T08:00:00.000Z',
    })
  })

  it('falls back to action-specific copy when model output is sparse', () => {
    const result = normalizeStageCoachActionResult({
      action: 'summary',
      payload: {
        title: '',
        bullets: ['', null as unknown as string],
        followUp: '',
      },
    })

    expect(result.action).toBe('summary')
    expect(result.title).toBe('整理这一步')
    expect(result.bullets).toEqual(['把还缺的证据补上，再决定是否完成这步。'])
    expect(result.followUp).toBe('把还缺的证据补上，再决定是否完成这步。')
    expect(result.generatedAt).toEqual(expect.any(String))
  })
})

