import { describe, expect, it } from 'vitest'

import { buildSpeciesPageResourceSummary, buildStepReferenceInstruction } from '@/lib/ai/tutor/context-builders'

describe('buildSpeciesPageResourceSummary', () => {
  it('points bird species replies to the real audio card when audio exists', () => {
    const summary = buildSpeciesPageResourceSummary({
      natureTopic: 'birds',
      audioUrl: '/birds/call.mp3',
    })

    expect(summary).toContain('鸟鸣音频')
    expect(summary).toContain('播放真实鸟鸣')
    expect(summary).toContain('不要用文字拟声')
  })

  it('marks missing bird audio so the tutor does not pretend it exists', () => {
    const summary = buildSpeciesPageResourceSummary({
      natureTopic: 'birds',
      audioUrl: null,
    })

    expect(summary).toContain('暂无鸟鸣音频')
    expect(summary).toContain('不要假装')
  })
})

describe('buildStepReferenceInstruction', () => {
  it('requires exact step numbers and titles instead of inferred numbering', () => {
    const instruction = buildStepReferenceInstruction('项目步骤')

    expect(instruction).toContain('精确编号和标题')
    expect(instruction).toContain('不要自行改编号')
    expect(instruction).toContain('不确定编号')
  })
})
