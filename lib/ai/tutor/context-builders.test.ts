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
      'playground:minesweeper',
      { surface: 'playground', gameKey: 'minesweeper' },
    )

    expect(scene.title).toBe('扫雷')
    expect(scene.contextId).toBe('playground:minesweeper')
    expect(scene.playgroundGameKey).toBe('minesweeper')
    expect(scene.sceneCapabilities).toEqual(['hintMinesweeperCell'])
    expect(scene.summary).toContain('长按可插旗或撤旗')
    expect(scene.summary).toContain('「重开」会按当前难度重新开一局')
  })

  it('keeps the generic playground hub tool-neutral', async () => {
    const scene = await buildTutorSceneContext(
      {} as never,
      'user-1',
      'global',
      '',
      { surface: 'playground' },
    )

    expect(scene.title).toBe('益智游乐场')
    expect(scene.sceneCapabilities).toBeUndefined()
    expect(scene.summary).toContain('先手（黑棋）在双方完美对弈下必胜')
    expect(scene.summary).toContain('《五子棋博弈论入门》')
    expect(scene.summary).toContain('不要说站内没有五子棋课程')
  })

  it('uses a maze-specific playground scene without minesweeper rules or tools', async () => {
    const scene = await buildTutorSceneContext(
      {} as never,
      'user-1',
      'global',
      'playground:maze',
      { surface: 'playground', gameKey: 'maze' },
    )

    expect(scene.title).toBe('迷宫探险')
    expect(scene.contextId).toBe('playground:maze')
    expect(scene.playgroundGameKey).toBe('maze')
    expect(scene.sceneCapabilities).toBeUndefined()
    expect(scene.summary).toContain('不是扫雷')
    expect(scene.summary).toContain('BFS/DFS/A*')
    expect(scene.summary).toContain('运气步数少吗')
    expect(scene.summary).not.toContain('长按可插旗或撤旗')
    expect(scene.summary).not.toContain('hintMinesweeperCell')
  })

  it('keeps function wars hints at the function-family level', async () => {
    const scene = await buildTutorSceneContext(
      {} as never,
      'user-1',
      'global',
      'playground:functionwars',
      { surface: 'playground', gameKey: 'functionwars' },
    )

    expect(scene.title).toBe('函数战争')
    expect(scene.contextId).toBe('playground:functionwars')
    expect(scene.playgroundGameKey).toBe('functionwars')
    expect(scene.summary).toContain('函数族')
    expect(scene.summary).toContain('不要直接给出')
    expect(scene.summary).toContain('渐近线')
  })

  it('enriches playground gomoku facts with the live course id when available', async () => {
    const supabase = {
      from(table: string) {
        if (table !== 'courses') throw new Error(`unexpected table ${table}`)
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
          limit: async () => ({
            data: [{ id: 88, title: '五子棋博弈论入门', tags: ['五子棋'] }],
            error: null,
          }),
        }
      },
    }

    const scene = await buildTutorSceneContext(supabase as never, 'user-1', 'global', 'playground:gomoku', {
      surface: 'playground',
      gameKey: 'gomoku',
    })

    expect(scene.title).toBe('五子棋')
    expect(scene.playgroundGameKey).toBe('gomoku')
    expect(scene.summary).toContain('[course:88|五子棋博弈论入门]')
    expect(scene.summary).toContain('《五子棋博弈论入门》')
  })

  it('prepends recommendable courses on any scene when includeRecommendations is on', async () => {
    const supabase = {
      from(table: string) {
        if (table !== 'courses') throw new Error(`unexpected table ${table}`)
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
          limit: async () => ({
            data: [{ id: 88, title: '五子棋博弈论入门', tags: ['五子棋', '博弈论'] }],
            error: null,
          }),
        }
      },
    }

    const scene = await buildTutorSceneContext(supabase as never, 'user-1', 'global', '', {
      surface: 'home',
      includeRecommendations: true,
    })

    expect(scene.summary.startsWith('【可推荐的站内课程】')).toBe(true)
    expect(scene.summary).toContain('[course:88|五子棋博弈论入门]')
  })
})

describe('buildTutorSceneContext course Scratch context', () => {
  function createCourseContextSupabase(lessons: Array<{
    id: number
    title: string
    content: Record<string, unknown>
    steps: Array<{ title: string; description: string; checklist: unknown[] }>
  }>, course: { title: string; description: string } = { title: 'Scratch 课', description: '学 Scratch' }) {
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
        if (table === 'courses') return { data: course }
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

  it('injects gomoku fact points for the 五子棋 course', async () => {
    const lessons = [
      {
        id: 9,
        title: '认识棋盘与连五规则',
        content: {
          summary: '建立五子棋的基本规则',
          playground: { gameKey: 'gomoku', practiceHref: '/playground/gomoku' },
        },
        steps: [{ title: '看看棋盘', description: '15×15', checklist: [] }],
      },
    ]
    const supabase = createCourseContextSupabase(lessons, {
      title: '五子棋博弈论入门',
      description: '从规则到棋型',
    })

    const scene = await buildTutorSceneContext(supabase as never, 'user-1', 'course', '3', {
      lessonId: 9,
      lessonStepIndex: 0,
    })

    expect(scene.summary).toContain('先手（黑棋）在双方完美对弈下必胜')
    expect(scene.summary).toContain('自由五子棋（无禁手）')
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
