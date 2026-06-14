import { describe, expect, it } from 'vitest'

import { buildStepReferenceInstruction } from '@/lib/ai/tutor/context-builders'

describe('buildStepReferenceInstruction', () => {
  it('requires exact step numbers and titles instead of inferred numbering', () => {
    const instruction = buildStepReferenceInstruction('项目步骤')

    expect(instruction).toContain('精确编号和标题')
    expect(instruction).toContain('不要自行改编号')
    expect(instruction).toContain('不确定编号')
  })
})
