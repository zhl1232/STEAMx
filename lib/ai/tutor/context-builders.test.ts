import { describe, expect, it } from 'vitest'

import { buildStepReferenceInstruction, buildTutorSceneContext } from '@/lib/ai/tutor/context-builders'

describe('buildStepReferenceInstruction', () => {
  it('requires exact step numbers and titles instead of inferred numbering', () => {
    const instruction = buildStepReferenceInstruction('项目步骤')

    expect(instruction).toContain('精确编号和标题')
    expect(instruction).toContain('不要自行改编号')
    expect(instruction).toContain('不确定编号')
  })
})

describe('buildTutorSceneContext course Scratch context', () => {
  it('injects the current selected Scratch target into the course scene summary', async () => {
    const lessons = [
      {
        id: 42,
        title: '出场动画',
        content: { summary: '让角色说话' },
        steps: [
          {
            title: '出场说句话',
            description: '[[cat:events]] 的 [[block:events|当绿旗被点击]]',
            checklist: [],
          },
        ],
      },
    ]
    const createQuery = (table: string) => ({
      select() {
        return this
      },
      eq() {
        return this
      },
      order() {
        return this
      },
      limit() {
        return this
      },
      maybeSingle: async () => {
        if (table === 'courses') return { data: { title: 'Scratch 课', description: '学 Scratch' } }
        if (table === 'course_lessons') return { data: lessons[0] }
        return { data: null }
      },
      then(resolve: (value: unknown) => void) {
        if (table === 'course_lessons') {
          resolve({ data: lessons })
        } else if (table === 'user_lesson_progress') {
          resolve({ data: [] })
        } else {
          resolve({ data: [] })
        }
      },
    })
    const supabase = {
      from(table: string) {
        return createQuery(table)
      },
    }

    const scene = await buildTutorSceneContext(
      supabase as never,
      'user-1',
      'course',
      '7',
      {
        lessonId: 42,
        lessonStepIndex: 0,
        scratchEditorContext: {
          selectedTargetId: 'bear-1',
          selectedTargetName: 'Bear',
          targets: [
            { id: 'stage', name: 'Stage', isStage: true },
            { id: 'cat-1', name: '角色1', x: 0, y: 0, direction: 90, size: 100, visible: true, blockCount: 1 },
            { id: 'bear-1', name: 'Bear', x: 85, y: -15, direction: 90, size: 100, visible: true, blockCount: 0 },
          ],
        },
      },
    )

    expect(scene.summary).toContain('当前选中角色/对象：Bear')
    expect(scene.summary).toContain('如果它不是小猫，不要默认说“小猫”')
    expect(scene.summary).toContain('Bear：当前选中')
    expect(scene.summary).toContain('[[block:events|当绿旗被点击]]')
    expect(scene.summary).toContain('不要手写颜色')
  })
})
