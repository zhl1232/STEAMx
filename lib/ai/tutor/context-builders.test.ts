import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildStepReferenceInstruction, buildTutorSceneContext } from '@/lib/ai/tutor/context-builders'
import { getContentClassificationSettings } from '@/lib/content-classification'

vi.mock('@/lib/content-classification', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/content-classification')>(),
  getContentClassificationSettings: vi.fn(async () => ({
    publicV1Enabled: false,
    enforcementEnabled: false,
  })),
}))

beforeEach(() => {
  vi.mocked(getContentClassificationSettings).mockResolvedValue({
    publicV1Enabled: false,
    enforcementEnabled: false,
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
          in() {
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

describe('buildTutorSceneContext course context', () => {
  type CourseContextLesson = {
    id: number
    title: string
    lesson_type?: string | null
    course_id?: number
    content: Record<string, unknown> | null
    steps: Array<{ title: string; description: string; checklist?: unknown[] }>
  }
  type RecordedQuery = { table: string; selected?: string; filters: Array<[string, unknown]> }
  function createCourseContextSupabase(lessons: CourseContextLesson[], course: {
    title: string
    description: string
    status?: string
    classification_status?: string
  } | null = { title: 'Scratch 课', description: '学 Scratch' }, queries: RecordedQuery[] = []) {
    const createQuery = (table: string) => {
      const query: RecordedQuery = { table, filters: [] }
      queries.push(query)
      const matchingLessons = () => lessons
        .filter((lesson) => query.filters.every(([key, value]) => {
          if (key === 'id') return lesson.id === value
          if (key === 'course_id') return lesson.course_id === undefined || lesson.course_id === value
          return true
        }))
        .map((lesson) => ({ lesson_type: 'scratch', ...lesson }))
      return {
        select(selected: string) {
          query.selected = selected
          return this
        },
        eq(key: string, value: unknown) {
          query.filters.push([key, value])
          return this
        },
        order() {
          return this
        },
        limit() {
          return this
        },
        maybeSingle: async () => {
          if (table === 'courses') {
            const visible = course && query.filters.every(([key, value]) => {
              if (key === 'status') return (course.status ?? 'approved') === value
              if (key === 'classification_status') return (course.classification_status ?? 'reviewed') === value
              return true
            })
            return { data: visible ? course : null }
          }
          if (table === 'course_lessons') return { data: matchingLessons()[0] ?? null }
          return { data: null }
        },
        then(resolve: (value: unknown) => void) {
          if (table === 'course_lessons') {
            resolve({ data: matchingLessons() })
          } else if (table === 'user_lesson_progress') {
            resolve({ data: [] })
          } else {
            resolve({ data: [] })
          }
        },
      }
    }
    return {
      from(table: string) {
        return createQuery(table)
      },
    }
  }

  function buildingLesson(building3d: Record<string, unknown> = {}): CourseContextLesson {
    return {
      id: 42,
      title: '风车',
      lesson_type: 'building_3d',
      content: { building3d },
      steps: [{ title: '旧版顺序不能使用', description: '旧版搭建说明' }],
    }
  }

  const slides = Array.from({ length: 12 }, (_, index) => `/slides/${index + 1}.webp`)
  const modelSteps = Array.from({ length: 12 }, (_, index) => ({
    title: `搭建步骤 ${index + 1}`,
    description: `这是已审核的第 ${index + 1} 步文字说明`,
    partIds: [],
  }))

  it.each([
    [0, '认识风车', '认识本课主题，看看今天要完成的风车。'],
    [3, '结构分析', '观察作品各部分的结构、方向和连接方式。'],
    [4, '搭建步骤 1', '这是已审核的第 1 步文字说明'],
    [10, '搭建步骤 7', '这是已审核的第 7 步文字说明'],
    [16, '反思完善', '回顾搭建方法，检查结构并完善作品。'],
    [18, '完成本课', '完成本课并回顾今天的发现与作品。'],
  ])('uses mixed building page %i with its actual title and text', async (index, title, description) => {
    const lesson = buildingLesson({
      slideImageUrls: slides,
      ldrawModelUrl: '/models/windmill.mpd',
      steps3d: modelSteps,
    })
    const scene = await buildTutorSceneContext(createCourseContextSupabase([lesson]) as never,
      'user-1', 'course', '7', { lessonId: 42, lessonStepIndex: index })

    expect(scene.summary).toContain(`学生当前停在第${index + 1}页「${title}」（共 19 页）`)
    expect(scene.summary).toContain(`当前页面说明：${description}`)
    expect(scene.summary).not.toContain('旧版顺序不能使用')
    expect(scene.summary).not.toContain('Scratch 工作区')
    expect(scene.summary).toContain('不能当作 3D 模型的搭建步号')
    expect(scene.summary).toContain('没有读取课件图片、视频画面或模型连接几何')
    expect(scene.sceneCapabilities).toEqual(['focusCourseLessonStep'])
  })

  it('keeps late current and adjacent pages inside the actual 2400-character scene budget', async () => {
    const lesson = buildingLesson({
      slideImageUrls: slides,
      ldrawModelUrl: '/models/windmill.mpd',
      steps3d: modelSteps,
    })
    const scene = await buildTutorSceneContext(createCourseContextSupabase([lesson]) as never,
      'user-1', 'course', '7', { lessonId: 42, lessonStepIndex: 10 })

    const promptScene = scene.summary.slice(0, 2400)
    expect(promptScene).toContain('学生当前停在第11页「搭建步骤 7」')
    expect(promptScene).toContain('当前页面说明：这是已审核的第 7 步文字说明')
    expect(promptScene).toContain('上一页：第10页「搭建步骤 6」：这是已审核的第 6 步文字说明')
    expect(promptScene).toContain('下一页：第12页「搭建步骤 8」：这是已审核的第 8 步文字说明')
    expect(scene.summary).toContain('仅列当前位置附近的一部分')
    expect(scene.summary).not.toContain('第1页「认识风车」')
  })

  it.each([
    ['without a real model', { slideImageUrls: slides, steps3d: modelSteps }],
    ['without configured 3D steps', { slideImageUrls: slides, ldrawModelUrl: '/models/windmill.mpd' }],
  ])('uses the slide fallback %s', async (_label, building3d) => {
    const scene = await buildTutorSceneContext(createCourseContextSupabase([buildingLesson(building3d)]) as never,
      'user-1', 'course', '7', { lessonId: 42, lessonStepIndex: 4 })

    expect(scene.summary).toContain('学生当前停在第5页「作品构建 1」（共 10 页）')
    expect(scene.summary).toContain('按照课件完成第 1 个搭建步骤')
    expect(scene.summary).not.toContain('这是已审核的第 1 步文字说明')
    expect(scene.summary).not.toContain('旧版搭建说明')
  })

  it('uses model steps directly when there are no slide images', async () => {
    const scene = await buildTutorSceneContext(createCourseContextSupabase([buildingLesson({
      ldrawModelUrl: '/models/windmill.mpd',
      steps3d: modelSteps,
    })]) as never, 'user-1', 'course', '7', { lessonId: 42, lessonStepIndex: 8 })

    expect(scene.summary).toContain('学生当前停在第9页「搭建步骤 9」（共 12 页）')
    expect(scene.summary).toContain('上一页：第8页「搭建步骤 8」')
    expect(scene.summary).toContain('下一页：第10页「搭建步骤 10」')
    expect(scene.summary).not.toContain('旧版搭建说明')
  })

  it('uses the single video fallback without pretending to have watched it', async () => {
    const scene = await buildTutorSceneContext(createCourseContextSupabase([buildingLesson({
      videoUrl: '/videos/windmill.mp4',
    })]) as never, 'user-1', 'course', '7', { lessonId: 42, lessonStepIndex: 0 })

    expect(scene.summary).toContain('学生当前停在第1页「观看动画」（共 1 页）')
    expect(scene.summary).not.toContain('上一页：')
    expect(scene.summary).not.toContain('下一页：')
    expect(scene.summary).toContain('没有读取课件图片、视频画面或模型连接几何')
  })

  it.each([
    {},
    { steps3d: modelSteps },
    { ldrawModelUrl: '/models/windmill.mpd' },
    { slideImageUrls: ['', null, 5] },
  ])('keeps an empty building display flow empty instead of using legacy or demo steps: %j', async (building3d) => {
    const scene = await buildTutorSceneContext(createCourseContextSupabase([buildingLesson(building3d)]) as never,
      'user-1', 'course', '7', { lessonId: 42, lessonStepIndex: 0 })

    expect(scene.summary).toContain('没有可导航的展示步骤')
    expect(scene.summary).not.toContain('学生当前停在')
    expect(scene.summary).not.toContain('旧版顺序不能使用')
    expect(scene.sceneCapabilities).toEqual([])
  })

  it.each([-1, 99, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, undefined])(
    'does not invent a current page from invalid index %s', async (lessonStepIndex) => {
      const scene = await buildTutorSceneContext(createCourseContextSupabase([buildingLesson({
        videoUrl: '/videos/windmill.mp4',
      })]) as never, 'user-1', 'course', '7', { lessonId: 42, lessonStepIndex })

      expect(scene.summary).toContain('未收到有效的当前位置')
      expect(scene.summary).not.toContain('学生当前停在')
      expect(scene.summary).not.toContain('上一页：')
      expect(scene.summary).not.toContain('下一页：')
    },
  )

  it.each(['building_3d', 'playground', 'future_lesson', null])(
    'does not attach Scratch editor facts or action hints to %s lessons', async (lesson_type) => {
      const lesson: CourseContextLesson = {
        id: 42,
        title: '本课主题',
        lesson_type,
        steps: [{ title: '实际课时步骤', description: '请先观察问题' }],
        content: {
          building3d: { videoUrl: '/videos/topic.mp4' },
          requiredBlocks: [{ label: '当绿旗被点击', anyOf: ['event_whenflagclicked'] }],
        },
      }
      const scene = await buildTutorSceneContext(createCourseContextSupabase([lesson]) as never,
        'user-1', 'course', '7', {
          lessonId: 42,
          lessonStepIndex: 0,
          scratchEditorContext: {
            selectedTargetId: 'cat',
            selectedTargetName: '不属于本课的角色',
            targets: [{ id: 'cat', name: '不属于本课的角色' }],
          },
          scratchBlockTargetItemIndex: 0,
        })

      expect(scene.summary).not.toContain('Scratch 工作区')
      expect(scene.summary).not.toContain('不属于本课的角色')
      expect(scene.scratchEditorContext).toBeUndefined()
      expect(scene.scratchBlockItems).toEqual([])
      expect(scene.scratchBlockKeywords).toEqual([])
      expect(scene.scratchBlockTargetItemIndex).toBeUndefined()
      if (lesson_type === 'playground') {
        expect(scene.summary).toContain('游乐场实训工作区')
        expect(scene.summary).toContain('学生当前停在第1步「实际课时步骤」')
      } else if (lesson_type !== 'building_3d') {
        expect(scene.summary).toContain('尚未接入学习工作区')
        expect(scene.summary).toContain('学生当前停在第1步「实际课时步骤」')
      }
    },
  )

  it.each([
    ['unapproved course', { status: 'draft', classification_status: 'reviewed' }, false],
    ['unreviewed course when enforcement is on', { status: 'approved', classification_status: 'pending' }, true],
  ] as const)('preserves the content gate for an %s', async (_label, course, enforcementEnabled) => {
    vi.mocked(getContentClassificationSettings).mockResolvedValue({ publicV1Enabled: true, enforcementEnabled })
    const queries: RecordedQuery[] = []
    const supabase = createCourseContextSupabase([buildingLesson({ videoUrl: '/videos/topic.mp4' })], {
      title: '不可公开的课程',
      description: '不可公开的说明',
      ...course,
    }, queries)
    const scene = await buildTutorSceneContext(supabase as never,
      'user-1', 'course', '7', { lessonId: 42, lessonStepIndex: 0 })

    expect(scene.summary).not.toContain('不可公开')
    expect(scene.summary).not.toContain('风车')
    expect(scene.summary).not.toContain('当前课时')
    expect(scene.sceneCapabilities).toEqual([])
    expect(queries.find((query) => query.table === 'courses')?.filters).toContainEqual(['status', 'approved'])
    if (enforcementEnabled) {
      expect(queries.find((query) => query.table === 'courses')?.filters).toContainEqual(['classification_status', 'reviewed'])
    }
  })

  it('keeps current lesson lookup scoped to the course and progress scoped to its user', async () => {
    const queries: RecordedQuery[] = []
    const foreignLesson = { ...buildingLesson({ videoUrl: '/videos/topic.mp4' }), course_id: 8 }
    const scene = await buildTutorSceneContext(createCourseContextSupabase([foreignLesson], undefined, queries) as never,
      'user-1', 'course', '7', { lessonId: 42, lessonStepIndex: 0 })

    expect(scene.summary).not.toContain('风车')
    expect(scene.sceneCapabilities).toEqual([])
    const currentLessonQuery = queries.find((query) => query.table === 'course_lessons' && query.selected?.includes('content'))
    expect(currentLessonQuery?.selected).toContain('lesson_type')
    expect(currentLessonQuery?.filters).toContainEqual(['id', 42])
    expect(currentLessonQuery?.filters).toContainEqual(['course_id', 7])
    expect(queries.find((query) => query.table === 'user_lesson_progress')?.filters).toEqual([
      ['user_id', 'user-1'], ['course_lessons.course_id', 7],
    ])
  })

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

  it('keeps late Scratch steps and block markers in their original lesson order', async () => {
    const lesson: CourseContextLesson = {
      id: 42,
      title: '完整编程课',
      lesson_type: 'scratch',
      content: { building3d: { videoUrl: '/ignored-other-workspace.mp4' } },
      steps: Array.from({ length: 12 }, (_, index) => ({
        title: `编程任务 ${index + 1}`,
        description: index === 10
          ? '使用 [[block:looks|说 完成啦！]]'
          : `原始第 ${index + 1} 步文字`,
      })),
    }
    const scene = await buildTutorSceneContext(createCourseContextSupabase([lesson]) as never,
      'user-1', 'course', '7', { lessonId: 42, lessonStepIndex: 10 })

    expect(scene.summary).toContain('学生当前停在第11步「编程任务 11」（共 12 步）')
    expect(scene.summary).toContain('当前步骤说明：使用 [[block:looks|说 完成啦！]]')
    expect(scene.summary).toContain('上一步：第10步「编程任务 10」：原始第 10 步文字')
    expect(scene.summary).toContain('下一步：第12步「编程任务 12」：原始第 12 步文字')
    expect(scene.summary).not.toContain('观看动画')
    expect(scene.scratchBlockItems?.map((item) => item.findLabel)).toEqual(['说 你好!'])
  })

  it('injects gomoku fact points for the 五子棋 course', async () => {
    const lessons = [
      {
        id: 9,
        title: '认识棋盘与连五规则',
        lesson_type: 'playground',
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
            in() {
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
