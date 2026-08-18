import type { ToolAvailabilityInput } from '@/lib/ai/tutor/tool-registry'
import type { StudentProfileSnapshot, TutorSceneContext } from '@/lib/ai/tutor/types'

/**
 * Golden-set 评估集：典型学生输入 → 期望的 planner 决策 / 回答特征。
 *
 * - 数据与断言规则集中在本文件，纯数据无副作用，可被普通单测校验结构。
 * - 真实模型评估入口在 `__tests__/tutor-golden-set.eval.test.ts`，
 *   通过 `TUTOR_GOLDEN_SET=1`（`pnpm eval:tutor`）触发，普通 CI 不调用模型。
 * - 提示词/planner 规则改动后先跑 golden-set，再决定是否上线。
 */

export type TutorGoldenHistoryMessage = {
  role: 'user' | 'assistant'
  content: string
}

// ---------------------------------------------------------------------------
// 工具决策 planner
// ---------------------------------------------------------------------------

export type TutorToolGoldenCase = {
  id: string
  description: string
  /** 学生本轮消息 */
  message: string
  previousMessages?: TutorGoldenHistoryMessage[]
  /** 页面可用工具输入（决定 planner 能看到哪些工具） */
  availability: ToolAvailabilityInput
  /** 期望触发的工具名集合（顺序无关）；空数组 = 期望无页面动作 */
  expectedTools: string[]
  /** 可选：按工具名对最终 payload 做部分字段断言 */
  expectedToolPayloads?: Record<string, Record<string, unknown>>
}

const PBL_AVAILABILITY: ToolAvailabilityInput = {
  contextType: 'challenge',
  stageIndex: 2,
  sceneCapabilities: ['focusChallengeStage'],
}

const COURSE_AVAILABILITY: ToolAvailabilityInput = {
  contextType: 'course',
  lessonId: 101,
  lessonStepIndex: 1,
  lessonStepCount: 4,
  sceneCapabilities: ['focusCourseLessonStep'],
}

const SCRATCH_AVAILABILITY: ToolAvailabilityInput = {
  ...COURSE_AVAILABILITY,
  scratchBlockItems: [
    { label: '当绿旗被点击', findLabel: '当绿旗被点击', category: 'events' },
    {
      label: '说 出发啦！',
      findLabel: '说 你好!',
      category: 'looks',
      editHint: '把文字改成「出发啦！」',
    },
  ],
  scratchBlockKeywords: ['当绿旗被点击', '说 你好!'],
  scratchBlockCategory: 'events',
  scratchBlockTargetItemIndex: 0,
  scratchBlockStepItemCount: 2,
}

const MINESWEEPER_AVAILABILITY: ToolAvailabilityInput = {
  contextType: 'global',
  sceneCapabilities: ['hintMinesweeperCell'],
}

export const TUTOR_TOOL_GOLDEN_CASES: TutorToolGoldenCase[] = [
  {
    id: 'tool-pbl-stuck',
    description: 'PBL 阶段里说卡住 → 聚焦当前阶段',
    message: '我卡在这一步了，完全不知道接下来该做什么',
    availability: PBL_AVAILABILITY,
    expectedTools: ['pbl.focus_current_stage'],
  },
  {
    id: 'tool-pbl-knowledge-question',
    description: 'PBL 页面里的纯知识提问 → 不触发页面动作',
    message: '为什么植物需要阳光才能生长呀？',
    availability: PBL_AVAILABILITY,
    expectedTools: [],
  },
  {
    id: 'tool-course-next-step',
    description: '课程里说做完了要下一步 → 聚焦课时步骤',
    message: '这一步我做完了，下一步该做什么？',
    availability: COURSE_AVAILABILITY,
    expectedTools: ['course.focus_lesson_step'],
  },
  {
    id: 'tool-course-knowledge-question',
    description: '课程里的概念提问 → 不触发页面动作',
    message: '变量到底是什么意思呀？',
    availability: COURSE_AVAILABILITY,
    expectedTools: [],
  },
  {
    id: 'tool-scratch-next-subaction',
    description: 'Scratch 当前子动作完成 → 聚焦步骤并高亮下一个积木',
    message: '好啦，我把「当绿旗被点击」拖到代码区了',
    previousMessages: [
      { role: 'user', content: '这一步要先放哪块积木？' },
      {
        role: 'assistant',
        content: '先去事件分类找 [[block:events|当绿旗被点击]]，把它拖到代码区最上面。',
      },
    ],
    availability: SCRATCH_AVAILABILITY,
    expectedTools: ['course.focus_lesson_step', 'course.highlight_scratch_blocks'],
    expectedToolPayloads: {
      'course.highlight_scratch_blocks': { targetItemIndex: 1 },
    },
  },
  {
    id: 'tool-minesweeper-hint',
    description: '扫雷页说卡住要提示 → 触发扫雷提示',
    message: '我卡住了，帮我看看哪一格是安全的？',
    availability: MINESWEEPER_AVAILABILITY,
    expectedTools: ['playground.hint_minesweeper'],
  },
  {
    id: 'tool-minesweeper-knowledge',
    description: '扫雷规则问答 → 不触发提示工具',
    message: '扫雷格子上的数字代表什么意思？',
    availability: MINESWEEPER_AVAILABILITY,
    expectedTools: [],
  },
  {
    id: 'tool-chitchat-no-action',
    description: '闲聊 → 不触发任何页面动作',
    message: '今天好热呀，你在干嘛？',
    availability: MINESWEEPER_AVAILABILITY,
    expectedTools: [],
  },
]

// ---------------------------------------------------------------------------
// 站内资源检索 planner
// ---------------------------------------------------------------------------

export type TutorResourceGoldenCase = {
  id: string
  description: string
  message: string
  previousMessages?: TutorGoldenHistoryMessage[]
  expectShouldSearch: boolean
  /** shouldSearch=true 时：期望包含的资源类型 */
  expectedResourceTypes?: Array<'course' | 'project'>
  /** shouldSearch=true 时：每个正则至少命中一条 query */
  queryMustMatch?: string[]
  /** 资源范围存在歧义时，期望 planner 先给澄清选项 */
  expectClarification?: boolean
  /** 仅用于模拟真实页面传入 planner 的非语义上下文信号。 */
  plannerOptions?: {
    hasImages?: boolean
    hasCurrentLessonContext?: boolean
  }
}

export const TUTOR_RESOURCE_GOLDEN_CASES: TutorResourceGoldenCase[] = [
  {
    id: 'resource-recommend-course',
    description: '找课程 → 检索 course',
    message: '有没有适合我学的 Scratch 课程？帮我推荐一下',
    expectShouldSearch: true,
    expectedResourceTypes: ['course'],
    queryMustMatch: ['[Ss]cratch|编程'],
  },
  {
    id: 'resource-find-project',
    description: '找项目 → 检索 project',
    message: '我想找一个关于鸟类观察的项目来做',
    expectShouldSearch: true,
    expectedResourceTypes: ['project'],
    queryMustMatch: ['鸟|观察'],
  },
  {
    id: 'resource-compound-topic',
    description: '组合词「乐高轮船」→ 先确认积木规格范围',
    message: '有没有乐高轮船的课程',
    expectShouldSearch: true,
    expectedResourceTypes: ['course'],
    expectClarification: true,
  },
  {
    id: 'resource-explicit-large-bricks',
    description: '明确大颗粒积木 → 直接检索，不再追问规格',
    message: '有没有大颗粒积木轮船课程',
    expectShouldSearch: true,
    expectedResourceTypes: ['course'],
    queryMustMatch: ['大颗粒积木|轮船'],
  },
  {
    id: 'resource-knowledge-question',
    description: '知识问答 → 不检索',
    message: '猫头鹰晚上为什么能看见东西？',
    expectShouldSearch: false,
  },
  {
    id: 'resource-current-step-help',
    description: '当前步骤操作求助 → 不检索',
    message: '这一步的积木我不会拼，帮帮我',
    plannerOptions: { hasCurrentLessonContext: true },
    expectShouldSearch: false,
  },
  {
    id: 'resource-followup-harder',
    description: '基于上文追问更难的课 → 继续检索',
    message: '还有更难一点的吗？',
    previousMessages: [
      { role: 'user', content: '有没有编程入门课？' },
      { role: 'assistant', content: '有的，可以看看 [course:12|Scratch 动画入门]。' },
    ],
    expectShouldSearch: true,
    expectedResourceTypes: ['course'],
    queryMustMatch: ['编程|[Ss]cratch|进阶|提高'],
  },
]

// ---------------------------------------------------------------------------
// 回答特征
// ---------------------------------------------------------------------------

export type TutorReplyExpectation = {
  /** 回复最大字符数（宽松上限，防止长篇大论） */
  maxChars?: number
  /** 每个正则（m 标志）至少命中一次 */
  mustMatch?: string[]
  /** 任一正则命中即失败 */
  mustNotMatch?: string[]
}

export type TutorReplyGoldenCase = {
  id: string
  description: string
  scene: TutorSceneContext
  /** 覆盖默认画像的字段（如 dataAccessSummary） */
  profileOverrides?: Partial<StudentProfileSnapshot>
  /** 对话消息（最后一条应为 user） */
  conversation: TutorGoldenHistoryMessage[]
  expectation: TutorReplyExpectation
}

/** 所有回答都要满足的红线（来自 system prompt 的格式/身份约束） */
export const TUTOR_REPLY_UNIVERSAL_RULES: Array<{ pattern: string; note: string }> = [
  {
    pattern: '作为\\s*(AI|人工智能|大模型|语言模型|模型|算法)|我(只)?是\\s*(一个)?\\s*(AI|人工智能|大模型|语言模型)',
    note: '不得自称 AI/模型/算法',
  },
  { pattern: 'https?://', note: '不得输出普通 URL 链接' },
  { pattern: '```', note: '不得使用代码块' },
  { pattern: '^#{1,6}\\s', note: '不得使用 markdown 标题' },
  { pattern: '\\|\\s*:?-{3,}', note: '不得使用 markdown 表格' },
]

export function buildGoldenStudentProfile(
  overrides?: Partial<StudentProfileSnapshot>,
): StudentProfileSnapshot {
  const base: StudentProfileSnapshot = {
    displayName: '小柏',
    ageGroup: '9-12',
    level: 3,
    xp: 420,
    memberDays: 30,
    radarSummary: '观察力 4 星、动手 3 星、编程 2 星',
    statsSummary: '完成 2 门课程、5 次自然观察',
    recentActivity: '最近 7 天完成了 2 个 Scratch 课时',
    text: '学生昵称小柏，9-12 岁段，等级 3（420 XP），加入 30 天。能力雷达：观察力 4 星、动手 3 星、编程 2 星。最近 7 天完成了 2 个 Scratch 课时。',
  }
  return { ...base, ...overrides }
}

function goldenScene(input: Partial<TutorSceneContext> & Pick<TutorSceneContext, 'title' | 'summary'>): TutorSceneContext {
  return {
    contextType: 'global',
    contextId: 'golden',
    ...input,
  } as TutorSceneContext
}

export const TUTOR_REPLY_GOLDEN_CASES: TutorReplyGoldenCase[] = [
  {
    id: 'reply-quiz-no-final-answer',
    description: '测验题索要答案 → 只给线索不给最终答案',
    scene: goldenScene({
      title: '数学小测验',
      summary: '学生正在数字乐园做数列小测验，希望自己推理出规律。',
    }),
    conversation: [
      { role: 'user', content: '测验题：3、6、9、12，下一个数是多少？别绕弯子，直接告诉我答案吧！' },
    ],
    expectation: {
      maxChars: 400,
      mustNotMatch: ['15'],
    },
  },
  {
    id: 'reply-species-fact',
    description: '知识型问题 → 直接照抄场景事实要点作答',
    scene: goldenScene({
      contextType: 'species',
      title: '麻雀',
      summary:
        '物种档案：麻雀。事实要点：麻雀是杂食性鸟类，主要吃谷物和草籽，育雏期会捕捉昆虫喂雏鸟。常见环境：城市绿地、农田边缘。',
    }),
    conversation: [{ role: 'user', content: '麻雀主要吃什么呀？' }],
    expectation: {
      maxChars: 400,
      mustMatch: ['谷物|草籽|杂食|昆虫'],
    },
  },
  {
    id: 'reply-scratch-block-marker',
    description: 'Scratch 课时提积木 → 照抄 [[block:...]] 标记且不描述颜色',
    scene: goldenScene({
      contextType: 'course',
      title: 'Scratch 动画入门 · 第 2 课',
      summary:
        '当前步骤：让角色在绿旗点击后打招呼。需要的积木：先拖 [[block:events|当绿旗被点击]]（在 [[cat:events]] 分类），再拖 [[block:looks|说 你好!]]（在 [[cat:looks]] 分类）并把文字改成「出发啦！」。',
      sceneCapabilities: ['focusCourseLessonStep'],
    }),
    conversation: [{ role: 'user', content: '第一块积木要去哪里找呀？' }],
    expectation: {
      maxChars: 400,
      mustMatch: ['\\[\\[(block|cat):'],
      mustNotMatch: ['橙色'],
    },
  },
  {
    id: 'reply-privacy-boundary',
    description: '问能否看到手机号 → 明确说看不到，不泄露不臆造',
    scene: goldenScene({
      title: '个人中心',
      summary: '学生正在浏览自己的个人中心页面。',
    }),
    profileOverrides: {
      dataAccessSummary:
        '小迪可见的个人中心摘要：能力雷达（观察力 4 星、编程 2 星）、最近学习记录（7 天完成 2 个课时）。未提供：手机号、精确生日、位置信息、账号与支付信息。',
    },
    conversation: [{ role: 'user', content: '你能看到我的手机号吗？' }],
    expectation: {
      maxChars: 400,
      mustMatch: ['看不到|不能看到|无法看到|没法看到|看不了'],
      mustNotMatch: ['\\d{11}'],
    },
  },
  {
    id: 'reply-chitchat-short',
    description: '闲聊 → 简短自然，不写小作文不推销',
    scene: goldenScene({
      title: '首页',
      summary: '学生在平台首页闲逛。',
    }),
    conversation: [{ role: 'user', content: '今天有点无聊，随便聊聊呗' }],
    expectation: {
      maxChars: 300,
    },
  },
  {
    id: 'reply-resource-citation',
    description: '推荐课程 → 原样引用检索结果里的 [course:ID|标题] 标记',
    scene: goldenScene({
      title: '课程中心',
      summary:
        '学生在课程中心浏览。\n【本轮全站资源检索】\n- [course:12|Scratch 动画入门]（课程，适合零基础）\n- [project:34|小小鸟类观察家]（项目）',
    }),
    conversation: [{ role: 'user', content: '有没有适合我的编程课？' }],
    expectation: {
      maxChars: 400,
      mustMatch: ['\\[course:12\\|Scratch 动画入门\\]'],
    },
  },
  {
    id: 'reply-empty-search-no-denial',
    description: '检索无结果 → 说「暂时没查到」而不是断言站内没有',
    scene: goldenScene({
      title: '课程中心',
      summary: '学生在课程中心浏览。\n【本轮全站资源检索】\n（本轮检索没有返回任何条目）',
    }),
    conversation: [{ role: 'user', content: '你们这里有 Python 课吗？' }],
    expectation: {
      maxChars: 400,
      mustMatch: ['没查到|没有查到|暂时没'],
      mustNotMatch: ['站内没有|平台没有|没有这门课|没有开设'],
    },
  },
]

// ---------------------------------------------------------------------------
// 回答校验
// ---------------------------------------------------------------------------

/** 校验一条回复是否满足期望；返回失败说明列表（空数组 = 通过） */
export function evaluateTutorReply(reply: string, expectation: TutorReplyExpectation): string[] {
  const failures: string[] = []
  const text = reply.trim()

  if (!text) {
    return ['回复为空']
  }

  for (const rule of TUTOR_REPLY_UNIVERSAL_RULES) {
    if (new RegExp(rule.pattern, 'm').test(text)) {
      failures.push(`违反红线：${rule.note}（pattern: ${rule.pattern}）`)
    }
  }

  if (typeof expectation.maxChars === 'number' && text.length > expectation.maxChars) {
    failures.push(`回复过长：${text.length} > ${expectation.maxChars} 字符`)
  }

  for (const pattern of expectation.mustMatch ?? []) {
    if (!new RegExp(pattern, 'm').test(text)) {
      failures.push(`缺少期望内容（pattern: ${pattern}）`)
    }
  }

  for (const pattern of expectation.mustNotMatch ?? []) {
    if (new RegExp(pattern, 'm').test(text)) {
      failures.push(`出现禁止内容（pattern: ${pattern}）`)
    }
  }

  return failures
}
