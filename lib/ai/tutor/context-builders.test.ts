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

describe('buildTutorSceneContext playground capabilities', () => {
  it('allows the playground server scene to intersect with a mounted minesweeper handler', async () => {
    const scene = await buildTutorSceneContext(
      {} as never,
      'user-1',
      'global',
      '',
      { surface: 'playground' },
    )

    expect(scene.sceneCapabilities).toEqual(['hintMinesweeperCell'])
  })
})

describe('buildTutorSceneContext course Scratch context', () => {
  function createCourseContextSupabase(lessons: Array<{
    id: number
    title: string
    content: Record<string, unknown>
    steps: Array<{ title: string; description: string; checklist: unknown[] }>
  }>) {
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
    return {
      from(table: string) {
        return createQuery(table)
      },
    }
  }

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
    const supabase = createCourseContextSupabase(lessons)

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
    expect(scene.sceneCapabilities).toEqual(['focusCourseLessonStep'])
  })

  it('marks the current Scratch sub-action in multi-block lesson steps', async () => {
    const lessons = [
      {
        id: 42,
        title: '出场动画',
        content: { summary: '让角色说话' },
        steps: [
          {
            title: '出场说句话',
            description: '[[cat:events]] 的 [[block:events|当绿旗被点击]]，再用 [[cat:looks]] 的 [[block:looks|说 出发啦！]]',
            checklist: [],
          },
        ],
      },
    ]
    const supabase = createCourseContextSupabase(lessons)

    const scene = await buildTutorSceneContext(
      supabase as never,
      'user-1',
      'course',
      '7',
      {
        lessonId: 42,
        lessonStepIndex: 0,
        scratchBlockTargetItemIndex: 1,
      },
    )

    expect(scene.summary).toContain('当前步骤含 2 个 Scratch 动作，页面正提示第 2 个')
    expect(scene.summary).toContain('本次回复先讲标成“当前要做”的动作')
    expect(scene.summary).toContain('不要直接跳到下一课时步骤')
    expect(scene.summary).toContain('当前要做：[[block:looks|说 你好!]]')
    expect(scene.scratchBlockTargetItemIndex).toBe(1)
    expect(scene.sceneCapabilities).toEqual(['focusCourseLessonStep'])
  })

  it('filters Scratch block hints that already exist on the selected target', async () => {
    const lessons = [
      {
        id: 42,
        title: '加点声音',
        content: { summary: '让角色出场并播放声音' },
        steps: [
          {
            title: '加点声音',
            description: '先用 [[cat:events]] 的 [[block:events|当绿旗被点击]]，再接 [[cat:sound]] 的 [[block:sound|播放声音 Meow]]',
            checklist: [],
          },
        ],
      },
    ]
    const supabase = createCourseContextSupabase(lessons)

    const scene = await buildTutorSceneContext(
      supabase as never,
      'user-1',
      'course',
      '7',
      {
        lessonId: 42,
        lessonStepIndex: 0,
        scratchEditorContext: {
          selectedTargetId: 'cat-1',
          selectedTargetName: '角色1',
          targets: [
            { id: 'stage', name: 'Stage', isStage: true },
            {
              id: 'cat-1',
              name: '角色1',
              blockCount: 1,
              blocks: [{ id: 'block-1', type: 'event_whenflagclicked' }],
            },
          ],
        },
      },
    )

    expect(scene.scratchBlockItems?.map((item) => item.findLabel)).toEqual(['播放声音 Meow'])
    expect(scene.scratchBlockKeywords).toEqual(['播放声音 Meow'])
    expect(scene.summary).toContain('当前选中对象已经有这些本步骤相关积木：当绿旗被点击')
    expect(scene.summary).not.toContain('当前要做：[[block:events|当绿旗被点击]]')
  })

  it('keeps editable Scratch hints pending even when the same opcode already exists', async () => {
    const lessons = [
      {
        id: 42,
        title: '出场动画',
        content: { summary: '让角色说话' },
        steps: [
          {
            title: '出场说句话',
            description: '[[cat:looks]] 的 [[block:looks|说 出发啦！]]',
            checklist: [],
          },
        ],
      },
    ]
    const supabase = createCourseContextSupabase(lessons)

    const scene = await buildTutorSceneContext(
      supabase as never,
      'user-1',
      'course',
      '7',
      {
        lessonId: 42,
        lessonStepIndex: 0,
        scratchEditorContext: {
          selectedTargetId: 'cat-1',
          selectedTargetName: '角色1',
          targets: [
            {
              id: 'cat-1',
              name: '角色1',
              blockCount: 1,
              blocks: [{ id: 'block-1', type: 'looks_say' }],
            },
          ],
        },
      },
    )

    expect(scene.scratchBlockItems?.map((item) => item.findLabel)).toEqual(['说 你好!'])
    expect(scene.summary).toContain('拖出后把文字改成「出发啦！」')
    expect(scene.summary).not.toContain('当前选中对象已经有这些本步骤相关积木：说 你好!')
  })

  it('resets the pending Scratch target index when the previously highlighted opcode-only action is complete', async () => {
    const lessons = [
      {
        id: 42,
        title: '出场动画',
        content: { summary: '让角色说话' },
        steps: [
          {
            title: '出场说句话',
            description: '[[cat:events]] 的 [[block:events|当绿旗被点击]]，再用 [[cat:looks]] 的 [[block:looks|说 出发啦！]]',
            checklist: [],
          },
        ],
      },
    ]
    const supabase = createCourseContextSupabase(lessons)

    const scene = await buildTutorSceneContext(
      supabase as never,
      'user-1',
      'course',
      '7',
      {
        lessonId: 42,
        lessonStepIndex: 0,
        scratchBlockTargetItemIndex: 0,
        scratchEditorContext: {
          selectedTargetId: 'cat-1',
          selectedTargetName: '角色1',
          targets: [
            {
              id: 'cat-1',
              name: '角色1',
              blockCount: 1,
              blocks: [{ id: 'block-1', type: 'event_whenflagclicked' }],
            },
          ],
        },
      },
    )

    expect(scene.scratchBlockItems?.map((item) => item.findLabel)).toEqual(['说 你好!'])
    expect(scene.scratchBlockTargetItemIndex).toBeUndefined()
    expect(scene.scratchBlockStepItemCount).toBe(2)
  })
})

describe('buildTutorSceneContext challenge capability defaults', () => {
  it('includes the challenge focus capability for active stage scenes', async () => {
    const supabase = {
      from(table: string) {
        const challenge = {
          title: '风力小车',
          driving_question: '怎么让小车跑起来？',
          constraints: [],
          stages: [
            { title: '观察问题', description: '先看看需求', kind: 'observe' },
          ],
        }

        if (table === 'challenges') {
          return {
            select() {
              return this
            },
            eq() {
              return this
            },
            maybeSingle: async () => ({ data: challenge }),
          }
        }

        if (table === 'challenge_workspaces') {
          return {
            select() {
              return this
            },
            eq() {
              return this
            },
            maybeSingle: async () => ({ data: null, error: null }),
          }
        }

        return {
          select() {
            return this
          },
          eq() {
            return this
          },
          order() {
            return this
          },
          maybeSingle: async () => ({ data: null }),
          then(resolve: (value: unknown) => void) {
            resolve({ data: [] })
          },
        }
      },
    }

    const scene = await buildTutorSceneContext(
      supabase as never,
      'user-1',
      'challenge',
      '12',
      { stageIndex: 0 },
    )

    expect(scene.sceneCapabilities).toEqual(['focusChallengeStage'])
  })
})
