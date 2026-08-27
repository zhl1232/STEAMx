import type { SupabaseClient } from '@supabase/supabase-js'

import type { TutorSceneCapability } from '@/lib/ai/tutor/scene-capabilities'
import type { TutorGlobalSurface, TutorPlaygroundGameKey, TutorSceneContext } from '@/lib/ai/tutor/types'
import {
  buildAvailableAudiosSummary,
  mapSpeciesRowToAudioRef,
  type TutorAudioRef,
} from '@/lib/ai/tutor/audio-tags'
import {
  formatGomokuCourseFact,
  GOMOKU_COURSE_TITLE,
  GOMOKU_TUTOR_FACTS,
  shouldInjectGomokuFacts,
} from '@/lib/ai/tutor/gomoku-facts'
import {
  fetchTutorRecommendableCourses,
  findTutorCourseByTitle,
  formatTutorCourseCatalog,
} from '@/lib/ai/tutor/course-catalog'
import { getStageProgressByUser } from '@/lib/api/challenge-stage-progress'
import { getWeeklyPlanTutorSummary } from '@/lib/api/weekly-plan-data'
import {
  buildScratchBlockHintItems,
  keepScratchRichTextBlockMarkers,
  resolveScratchBlockCategory,
  stripScratchRichTextMarkers,
  type ScratchBlockCategory,
  type ScratchBlockHintItem,
} from '@/lib/courses/scratch-hints'
import type { ScratchEditorContext } from '@/lib/courses/scratch-messages'
import {
  filterScratchBlockItemsByExistingBlocks,
  getSelectedScratchBlockTypes,
  getSelectedScratchTarget,
} from '@/lib/courses/scratch-step-check'
import type { CourseLessonStep, LessonContent } from '@/lib/courses/types'
import { getHomepageRecommendations } from '@/lib/home/recommendations'
import type { ChallengeStage } from '@/lib/mappers/types'
import { getContentClassificationSettings, mapPublicClassification } from '@/lib/content-classification'
import type { ContentClassificationRow } from '@/lib/content-classification/types'
import { mapChallengeWorkspace, type ChallengeWorkspaceRow } from '@/lib/pbl/challenge-workspace'
import { sanitizeTutorUGC } from '@/lib/ai/tutor/untrusted-text'
import type { Database } from '@/lib/supabase/types'
import { BRAND_FULL_NAME } from '@/lib/brand'

function compact(value: string | null | undefined, max = 400) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function compactLessonText(value: string | null | undefined, max = 400) {
  return compact(typeof value === 'string' ? stripScratchRichTextMarkers(value) : value, max)
}

function compactScratchStepText(value: string | null | undefined, max = 400) {
  return compact(typeof value === 'string' ? keepScratchRichTextBlockMarkers(value) : value, max)
}

function scratchMarkerCategory(category: ScratchBlockCategory) {
  return category === 'myBlocks' ? 'myblocks' : category
}

function clampScratchBlockItemIndex(index: number | undefined, count: number) {
  if (count <= 0) return undefined
  if (typeof index !== 'number' || !Number.isFinite(index)) return undefined
  return Math.min(Math.max(Math.trunc(index), 0), count - 1)
}

function formatScratchBlockReferenceItems(items: ScratchBlockHintItem[], targetItemIndex?: number) {
  if (!items.length) return ''
  const targetIndex = clampScratchBlockItemIndex(targetItemIndex, items.length)
  return items
    .slice(0, 4)
    .map((item, index) => {
      const block = item.category
        ? `[[block:${scratchMarkerCategory(item.category)}|${item.findLabel}]]`
        : item.findLabel
      const prefix = index === targetIndex ? '当前要做：' : ''
      return `- ${prefix}${block}${item.editHint ? `；拖出后${item.editHint}` : ''}`
    })
    .join('\n')
}

function resolvePendingScratchTargetItemIndex(input: {
  requestedIndex?: number
  allItemCount: number
  pendingOriginalIndexes: number[]
}) {
  if (input.pendingOriginalIndexes.length === 0) return undefined
  if (
    typeof input.requestedIndex !== 'number' ||
    !Number.isFinite(input.requestedIndex) ||
    input.allItemCount <= 0
  ) {
    return undefined
  }

  const requestedOriginalIndex = clampScratchBlockItemIndex(input.requestedIndex, input.allItemCount)
  if (typeof requestedOriginalIndex !== 'number') return undefined
  const pendingIndex = input.pendingOriginalIndexes.indexOf(requestedOriginalIndex)
  return pendingIndex >= 0 ? pendingIndex : undefined
}

function formatScratchNumber(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function formatScratchEditorContext(context?: ScratchEditorContext) {
  if (!context || !Array.isArray(context.targets) || context.targets.length === 0) return ''

  const selected = getSelectedScratchTarget(context)
  const selectedName = selected?.name ?? context.selectedTargetName
  const stage = context.targets.find((target) => target.isStage)
  const sprites = context.targets.filter((target) => !target.isStage).slice(0, 8)
  const selectedBlocks = [...getSelectedScratchBlockTypes(context)].slice(0, 12).join('、')
  const spriteLines = sprites
    .map((target) => {
      const facts = [
        target.id === selected?.id ? '当前选中' : '',
        target.visible === false ? '隐藏' : '',
        target.costumeName ? `造型「${sanitizeTutorUGC(target.costumeName, 24)}」` : '',
        formatScratchNumber(target.x) && formatScratchNumber(target.y)
          ? `坐标(${formatScratchNumber(target.x)}, ${formatScratchNumber(target.y)})`
          : '',
        formatScratchNumber(target.direction) ? `方向${formatScratchNumber(target.direction)}` : '',
        formatScratchNumber(target.size) ? `大小${formatScratchNumber(target.size)}` : '',
        typeof target.blockCount === 'number' ? `已有${target.blockCount}个积木` : '',
      ].filter(Boolean)
      return `- ${sanitizeTutorUGC(target.name, 40)}${facts.length ? `：${facts.join('，')}` : ''}`
    })
    .join('\n')

  return [
    '【Scratch 当前编辑器】',
    selectedName
      ? `当前选中角色/对象：${sanitizeTutorUGC(selectedName, 40)}。回答具体操作时优先围绕这个对象；如果它不是小猫，不要默认说“小猫”。`
      : '',
    selectedBlocks ? `当前选中对象已有积木 opcode：${selectedBlocks}` : '',
    stage?.name ? `舞台/背景对象：${sanitizeTutorUGC(stage.name, 40)}` : '',
    spriteLines ? `角色列表：\n${spriteLines}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function compactLines(lines: Array<string | null | undefined>) {
  return lines.filter(Boolean).join('\n')
}

function resolveDefaultSceneCapabilities(input: {
  contextType: TutorSceneContext['contextType']
  stageIndex?: number
  lessonId?: number
}) {
  const capabilities: TutorSceneCapability[] = []
  if (input.contextType === 'challenge' && typeof input.stageIndex === 'number') {
    capabilities.push('focusChallengeStage')
  }
  if (input.contextType === 'course' && typeof input.lessonId === 'number') {
    capabilities.push('focusCourseLessonStep')
  }
  return capabilities
}

export function buildStepReferenceInstruction(resourceLabel: string) {
  return `引用${resourceLabel}时，只能照抄上方已列出的精确编号和标题；如果不确定编号，就只说标题或区域名，不要自行改编号。`
}

export async function buildTutorSceneContext(
  supabase: SupabaseClient<Database>,
  userId: string,
  contextType: TutorSceneContext['contextType'],
  contextId: string,
  options?: {
    stageIndex?: number
    lessonId?: number
    lessonStepIndex?: number
    scratchBlockTargetItemIndex?: number
    scratchEditorContext?: ScratchEditorContext
    surface?: TutorGlobalSurface
    gameKey?: TutorPlaygroundGameKey
    includeRecommendations?: boolean
  },
): Promise<TutorSceneContext> {
  let scene: TutorSceneContext
  switch (contextType) {
    case 'challenge':
      scene = await buildChallengeContext(supabase, userId, contextId, options?.stageIndex)
      break
    case 'project':
      scene = await buildProjectContext(supabase, contextId)
      break
    case 'observation':
      scene = await buildObservationContext(supabase, userId, contextId)
      break
    case 'species':
      scene = await buildSpeciesContext(supabase, contextId)
      break
    case 'course':
      scene = await buildCourseContext(
        supabase,
        userId,
        contextId,
        options?.lessonId,
        options?.lessonStepIndex,
        options?.scratchBlockTargetItemIndex,
        options?.scratchEditorContext,
      )
      break
    default:
      scene = await buildGlobalContext(
        supabase,
        userId,
        contextId,
        options?.includeRecommendations ?? false,
        options?.surface,
        options?.gameKey,
      )
      break
  }

  // POST 对话时注入全站可推荐课程，任意页面问「有没有对应课」都能引用 [course:id|标题]
  if (options?.includeRecommendations) {
    scene = await appendRecommendableCourses(supabase, scene)
  }

  return scene
}

async function appendRecommendableCourses(
  supabase: SupabaseClient<Database>,
  scene: TutorSceneContext,
): Promise<TutorSceneContext> {
  try {
    const courses = await fetchTutorRecommendableCourses(supabase)
    const catalog = formatTutorCourseCatalog(courses)
    if (!catalog) return scene

    // 前置写入，避免长课时摘要被 prompt 截断时丢掉课程入口
    return {
      ...scene,
      summary: [catalog, scene.summary].filter(Boolean).join('\n\n'),
    }
  } catch {
    return scene
  }
}

/** global 场景按页面给出不同的标题（面板副标题「正在陪你：…」）与给模型的场景描述 */
const GLOBAL_SURFACE_SCENES: Record<TutorGlobalSurface, { title: string; summary: string }> = {
  home: {
    title: BRAND_FULL_NAME,
    summary: '学生正在浏览首页，可能想寻找下一步学习方向。',
  },
  explore: {
    title: '挑选新项目',
    summary: '学生正在逛项目库找动手项目，可以按他的兴趣和水平帮他挑选。',
  },
  nature: {
    title: '自然观察',
    summary: '学生正在逛自然观察频道（鸟类、昆虫、植物等专题），可以引导他开始或继续一次自然观察。',
  },
  create: {
    title: '项目挑战与技能课程',
    summary: '学生正在浏览项目挑战，可以帮他挑一个合适的开始，或引导去技能课程。',
  },
  courses: {
    title: '技能课程',
    summary: '学生正在看技能课程列表，可能想学编程、搭建或其他 STEAM 技能。',
  },
  community: {
    title: '项目挑战与技能课程',
    summary: '学生正在浏览项目挑战，可以帮他挑一个合适的开始，或引导去技能课程。',
  },
  playground: {
    title: '益智游乐场',
    summary: [
      '学生正在益智游乐场，可以聊聊各小游戏里的数学、策略和复盘方法。',
      '如果学生位于具体小游戏页面，必须以当前小游戏为准，不要把一个游戏的问题回答成另一个游戏。',
      // 静态事实兜底；buildGlobalContext 会再按库内课程 id 替换为带入口的版本
      GOMOKU_TUTOR_FACTS,
    ].join('\n'),
  },
  profile: {
    title: '回顾成长',
    summary: '学生正在查看自己的主页和成长记录，可以结合他的画像给出下一步的具体建议。',
  },
  users: {
    title: '逛同学主页',
    summary: '学生正在看其他同学的公开主页，可能被同学的作品启发，想自己也试试。',
  },
}

const PLAYGROUND_GAME_SCENES: Record<TutorPlaygroundGameKey, { title: string; summary: string; capabilities?: TutorSceneCapability[] }> = {
  minesweeper: {
    title: '扫雷',
    summary: [
      '学生正在玩扫雷。回答必须围绕扫雷棋盘、数字线索、插旗/挖掘和确定性推理。',
      '操作事实：工具栏可在「挖掘 / 插旗」两种模式间切换；挖掘模式下点击未翻开的格子是翻开，长按可插旗或撤旗；插旗模式下点击格子即可插旗或撤旗；「重开」会按当前难度重新开一局。',
      '提示边界：只能根据已翻开的数字和旗子做确定性推理；不能读取地雷答案，也不要直接标出所有雷或安全格。',
    ].join('\n'),
    capabilities: ['hintMinesweeperCell'],
  },
  gomoku: {
    title: '五子棋',
    summary: [
      '学生正在玩五子棋。回答必须围绕连五、冲四、活三、防守和落子顺序，不要切到扫雷、迷宫或其他游戏。',
      GOMOKU_TUTOR_FACTS,
    ].join('\n'),
  },
  life: {
    title: '生命游戏',
    summary: '学生正在玩康威生命游戏挑战。围绕细胞预算、演化代数、稳定结构/振荡结构和三星条件给提示，不要切到扫雷或迷宫。',
  },
  '2048': {
    title: '2048',
    summary: '学生正在玩 2048。围绕合并方向、保留最大数字角落、避免把大数字拆散和局面空间给提示。',
  },
  '24game': {
    title: '24 点',
    summary: '学生正在玩 24 点。围绕四则运算、凑 24 的中间数和括号组合给分层提示，不直接报完整答案。',
  },
  hanoi: {
    title: '汉诺塔',
    summary: '学生正在玩汉诺塔。围绕递归目标、先移动上层小盘、最少步数 2^n-1 和三根柱子的中间目标给提示。',
  },
  sudoku: {
    title: '数独',
    summary: '学生正在玩数独。围绕行、列、宫的候选数排除和唯一候选给提示，不直接填完整盘面。',
  },
  nqueens: {
    title: 'N 皇后',
    summary: '学生正在玩 N 皇后。围绕行列唯一、对角线冲突和逐行试探回溯给提示。',
  },
  fifteen: {
    title: '数字华容道',
    summary: '学生正在玩数字华容道。围绕空格移动、先完成前几行/列和保持已排好区域不要打乱给提示。',
  },
  memory: {
    title: '记忆翻牌',
    summary: '学生正在玩记忆翻牌。围绕记忆位置、主题图案分组和减少重复翻错给提示。',
  },
  quickmath: {
    title: '速算闪电战',
    summary: '学生正在玩速算闪电战。围绕心算拆分、先估后算和减少手误给提示。',
  },
  maze: {
    title: '迷宫探险',
    summary: [
      '学生正在玩迷宫探险，不是扫雷。回答必须围绕迷宫、岔路、路径记忆、迷雾探索、BFS/DFS/A* 复盘和步数效率；禁止把问题解释成扫雷，不要提地雷、插旗、挖掘、翻格或周围数字。',
      '当前迷宫规则：玩家只能看到附近区域，走过的区域会进入记忆地图；方向键/WASD/手机十字键都按地图绝对上下左右移动；撞墙只转向不计步；通关后全图揭开，并可对比 BFS、DFS、A* 的探索格数和路线步数。',
      '如果学生问“运气步数少吗”“为什么我走了很多步”，应解释：迷宫的随机性来自地图生成和玩家早期选择岔路；复盘里的 BFS/A* 是基于已知全图的算法基准，玩家闯关时看不到全图，所以多走路主要来自探索和记忆策略，不是扫雷式概率运气。',
    ].join('\n'),
  },
  tangram: {
    title: '七巧板',
    summary: '学生正在玩七巧板。围绕旋转、翻转、边角对齐和轮廓分解给提示。',
  },
  nonogram: {
    title: '数织',
    summary: '学生正在玩数织。围绕行列线索、连续色块长度、确定空格和逐步排除给提示。',
  },
  ballsort: {
    title: '球排序',
    summary: '学生正在玩球排序。围绕同色归并、腾出空管和避免堵住关键颜色给提示。',
  },
  balance: {
    title: '天平称重',
    summary: '学生正在玩天平称重。围绕分组称量、比较左右盘和用最少次数找异常硬币给提示。',
  },
  symmetry: {
    title: '像素对称',
    summary: '学生正在玩像素对称。当前规则是观察锁定的半边样本，在另一半手动补出镜像图案；围绕镜像轴、行列对应、误点修正和图案平衡给提示。',
  },
  functionwars: {
    title: '函数战争',
    summary: [
      '学生正在玩函数战争：炮弹从炮口出发，沿 y = y0 + f(x-x0) 的函数图像飞行。回答必须围绕函数图像、平移缩放、函数族和障碍位置，不要切到其他游戏。',
      '提示边界：只给函数族、参数变化方向或观察问题，例如一次函数斜率、抛物线开口、绝对值折点、正弦振幅与周期；不要直接给出能命中目标的完整最终函数。',
      '遇到不可破坏障碍时，引导学生比较轨迹与障碍的坐标范围；遇到 tan、1/x 等不连续函数时，说明渐近线会让弹道中断，不能穿越跳变。',
    ].join('\n'),
  },
}

async function buildGlobalContext(
  supabase: SupabaseClient<Database>,
  userId: string,
  contextId: string,
  includeRecommendations: boolean,
  surface?: TutorGlobalSurface,
  gameKey?: TutorPlaygroundGameKey,
): Promise<TutorSceneContext> {
  const scene = GLOBAL_SURFACE_SCENES[surface ?? 'home'] ?? GLOBAL_SURFACE_SCENES.home
  const playgroundScene = surface === 'playground' && gameKey ? PLAYGROUND_GAME_SCENES[gameKey] : null
  const summary = playgroundScene
    ? [
        playgroundScene.summary,
        '学生位于益智游乐场的具体小游戏页。当前小游戏优先级高于历史对话和通用游乐场知识。',
      ].join('\n\n')
    : scene.summary
  const base: TutorSceneContext = {
    contextType: 'global',
    contextId,
    title: playgroundScene?.title ?? scene.title,
    summary,
    surface,
    playgroundGameKey: gameKey,
    sceneCapabilities: playgroundScene?.capabilities,
  }

  if (surface === 'profile') {
    try {
      const planSummary = await getWeeklyPlanTutorSummary(supabase, userId)
      base.summary = [base.summary, '', '【本周探索计划】', planSummary].join('\n')
    } catch {
      // 本周计划查询失败不影响开场白或对话
    }
  }

  if (surface === 'playground') {
    try {
      const courses = await fetchTutorRecommendableCourses(supabase)
      const gomokuCourse = findTutorCourseByTitle(courses, GOMOKU_COURSE_TITLE)
      if (gomokuCourse?.id != null) {
        base.summary = base.summary.replace(GOMOKU_TUTOR_FACTS, formatGomokuCourseFact(gomokuCourse.id))
      }
    } catch {
      // 课程查询失败时保留静态事实要点
    }
  }

  // 开场白（GET）不查推荐，只有真正对话（POST）才注入候选项目，控制查询成本。
  if (!includeRecommendations) return base

  try {
    const { projects } = await getHomepageRecommendations({ limit: 6 })
    if (!projects.length) return base

    const lines = projects
      .map((project) => {
        const detail = [
          project.category,
          project.classification?.difficultyLabel ?? '',
        ]
          .filter(Boolean)
          .join('·')
        // 社区项目标题是不可信文本：清洗后再放进芯片标记，防止伪造额外芯片
        return `- [project:${project.id}|${sanitizeTutorUGC(project.title, 40)}]${detail ? `（${detail}）` : ''}`
      })
      .join('\n')

    return {
      ...base,
      summary: [
        base.summary,
        '',
        '【可推荐的站内项目】',
        '学生想找项目做时，从下面挑 1-2 个合适的推荐；引用时必须原样保留方括号格式（如 [project:12|项目名]），不要推荐列表之外的项目，也不要改写格式：',
        lines,
      ].join('\n'),
    }
  } catch {
    // 推荐查询失败不影响对话
    return base
  }
}

async function buildChallengeContext(
  supabase: SupabaseClient<Database>,
  userId: string,
  contextId: string,
  stageIndex?: number,
): Promise<TutorSceneContext> {
  const challengeId = Number.parseInt(contextId, 10)
  if (Number.isNaN(challengeId)) {
    return { contextType: 'challenge', contextId, title: '项目挑战', summary: '' }
  }

  const classificationSettings = await getContentClassificationSettings()
  let challengeQuery = supabase
    .from('challenges')
    .select('title, driving_question, constraints, stages')
    .eq('id', challengeId)
    .in('status', ['active', 'ended'])
  if (classificationSettings.enforcementEnabled) {
    challengeQuery = challengeQuery.eq('classification_status', 'reviewed')
  }
  const { data: challenge } = await challengeQuery.maybeSingle()

  if (!challenge) {
    return { contextType: 'challenge', contextId, title: '项目挑战', summary: '挑战不存在或已下架。' }
  }

  const stages = (Array.isArray(challenge.stages) ? challenge.stages : []) as unknown as ChallengeStage[]
  const idx = typeof stageIndex === 'number'
    ? Math.min(Math.max(stageIndex, 0), Math.max(stages.length - 1, 0))
    : 0
  const stage = stages[idx]

  const STATUS_LABEL: Record<string, string> = {
    not_started: '未开始',
    in_progress: '进行中',
    completed: '已完成',
  }

  const [progressList, workspaceResponse] = await Promise.all([
    getStageProgressByUser(supabase, challengeId, userId),
    supabase
      .from('challenge_workspaces')
      .select('project_goal, personal_plan, updated_at')
      .eq('challenge_id', challengeId)
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  if (workspaceResponse.error) throw workspaceResponse.error

  const workspace = workspaceResponse.data
    ? mapChallengeWorkspace(workspaceResponse.data as ChallengeWorkspaceRow)
    : null
  const personalStep = workspace?.personalPlan?.steps.find((item) => item.stageIndex === idx) ?? null
  const progressByIndex = new Map(progressList.map((item) => [item.stageIndex, item]))
  const progressSummary = stages
    .map((s, i) => {
      const p = progressByIndex.get(i)
      const status = STATUS_LABEL[p?.status ?? 'not_started'] ?? '未开始'
      const parts: string[] = []
      // 学生笔记与数据摘要是不可信输入，统一清洗后再进 prompt
      const notes = sanitizeTutorUGC(p?.notes, 240)
      if (notes) parts.push(notes)
      const dataSummary = typeof p?.data?.summary === 'string' ? sanitizeTutorUGC(p.data.summary, 200) : ''
      if (dataSummary) parts.push(`数据：${dataSummary}`)
      if (p?.images?.length) parts.push(`（${p.images.length} 张图片）`)
      const body = parts.length > 0 ? parts.join(' ') : '（暂无记录）'
      const marker = i === idx ? '👉 ' : ''
      return `${marker}第${i + 1}步「${s.title}」[${status}]：${body}`
    })
    .join('\n')

  const summary = [
    `挑战：${compact(challenge.title, 120)}`,
    challenge.driving_question ? `驱动问题：${compact(challenge.driving_question, 200)}` : '',
    Array.isArray(challenge.constraints) && challenge.constraints.length
      ? `约束：${challenge.constraints.map((c) => compact(String(c), 80)).join('；')}`
      : '',
    stage
      ? `当前阶段（${idx + 1}/${stages.length}）：${compact(stage.title, 120)}\n目标：${compact(stage.description, 400)}`
      : '',
    stage?.hint ? `提示：${compact(stage.hint, 200)}` : '',
    workspace?.projectGoal ? `学生自己的项目方向：${sanitizeTutorUGC(workspace.projectGoal, 180)}` : '',
    personalStep
      ? `当前阶段的个人化推进提示：${sanitizeTutorUGC(personalStep.focus, 180)} ${sanitizeTutorUGC(personalStep.evidencePrompt, 160)} ${sanitizeTutorUGC(personalStep.checkpointPrompt, 160)}`
      : '',
    progressSummary ? `\n【各阶段产出】\n${compact(progressSummary, 1400)}` : '',
    `【学生页面上有】阶段工作台、每一步的目标和产出记录。${buildStepReferenceInstruction('阶段步骤')}回复时尽量让学生对照当前阶段或已保存产出，不要整段复述页面内容。`,
  ]
    .filter(Boolean)
    .join('\n')

  const draftImages = progressByIndex.get(idx)?.images ?? []

  return {
    contextType: 'challenge',
    contextId,
    title: challenge.title,
    summary,
    stageIndex: idx,
    stageKind: stage?.kind ?? null,
    sceneCapabilities: resolveDefaultSceneCapabilities({ contextType: 'challenge', stageIndex: idx }),
    suggestedImages: draftImages.slice(0, 6),
  }
}

async function buildProjectContext(
  supabase: SupabaseClient<Database>,
  contextId: string,
): Promise<TutorSceneContext> {
  const projectId = Number.parseInt(contextId, 10)
  if (Number.isNaN(projectId)) {
    return { contextType: 'project', contextId, title: '探索项目', summary: '' }
  }

  const classificationSettings = await getContentClassificationSettings()
  let projectQuery = supabase
    .from('projects')
    .select('title, description, category, difficulty_stars, recommended_min_age, recommended_max_age, support_level, classification_status, classification_source, classification_reviewed_at, classification_reviewed_by, classification_revision, problem_statement, reflection, tags, status, moderation_state')
    .eq('id', projectId)
    .eq('status', 'approved')
    .eq('moderation_state', 'approved')
  if (classificationSettings.enforcementEnabled) {
    projectQuery = projectQuery.eq('classification_status', 'reviewed')
  }
  const { data: project } = await projectQuery.maybeSingle()

  if (!project) {
    return { contextType: 'project', contextId, title: '探索项目', summary: '项目不存在。' }
  }

  const [{ data: steps }, { data: materials }] = await Promise.all([
    supabase
      .from('project_steps')
      .select('title, description, sort_order')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
      .limit(6),
    supabase.from('project_materials').select('material').eq('project_id', projectId).limit(12),
  ])

  // 社区项目的标题、简介、步骤、材料都是创作者可编辑的不可信文本，统一清洗
  const stepSummary = (steps ?? [])
    .map((step, i) => `第${i + 1}步「${sanitizeTutorUGC(step.title ?? '步骤', 40) || '步骤'}」：${sanitizeTutorUGC(step.description, 100)}`)
    .join('\n')

  const materialText = (materials ?? [])
    .map((m) => sanitizeTutorUGC(m.material, 40))
    .filter(Boolean)
    .join('、')

  const classification = mapPublicClassification(project as unknown as ContentClassificationRow)
  const summary = [
    `项目：${sanitizeTutorUGC(project.title, 120)}`,
    project.category ? `分类：${project.category}` : '',
    classification?.ageLabel ? `适龄：${classification.ageLabel}` : '',
    classification?.supportLabel ? `成人支持：${classification.supportLabel}` : '',
    classification?.difficultyLabel ? `难度：${classification.difficultyLabel}` : '',
    project.description ? `简介：${sanitizeTutorUGC(project.description, 300)}` : '',
    project.problem_statement ? `问题：${sanitizeTutorUGC(project.problem_statement, 200)}` : '',
    materialText ? `材料：${materialText}` : '',
    stepSummary ? `页面步骤（按当前页面顺序，编号和标题必须照抄）：\n${stepSummary}` : '',
    `【学生页面上有】项目详情、材料清单和步骤列表。${buildStepReferenceInstruction('项目步骤')}需要学生动手时，直接引导他看页面里的材料清单或对应步骤标题，不要把整页内容重新念一遍。`,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    contextType: 'project',
    contextId,
    title: project.title,
    summary,
  }
}

const SPECIES_TOPIC_LABELS: Record<string, string> = {
  birds: '鸟类',
  insects: '昆虫',
  plants: '植物',
  fungi: '真菌',
}

function getSpeciesTopicLabel(topic: string | null | undefined) {
  return topic ? SPECIES_TOPIC_LABELS[topic] ?? topic : ''
}

export function buildSpeciesPageResourceSummary(input: {
  natureTopic?: string | null
  audioUrl?: string | null
}) {
  const resources = [
    '识别特征信息卡',
    '常见环境信息卡',
    '常见时段信息卡',
    '底部最近观察记录',
  ]
  if (input.natureTopic === 'birds') {
    resources.push(
      input.audioUrl
        ? '聊叫声时可简短说明识别要点；有录音时播放器会自动出现，不要提示用户去点听，也不要说「系统已附上」或文字拟声'
        : '本页暂无鸟鸣音频；聊叫声时不要假装页面有音频，也不要编造具体拟声',
    )
  }
  return `【学生页面上有】${resources.join('、')}。`
}

async function buildSpeciesContext(
  supabase: SupabaseClient<Database>,
  contextId: string,
): Promise<TutorSceneContext> {
  const slug = contextId.trim()
  if (!slug) {
    return { contextType: 'species', contextId, title: '物种档案', summary: '' }
  }

  const { data: species, error } = await supabase
    .from('species')
    .select(
      'common_name, scientific_name, aliases, taxon_group, identification_notes, habitat_notes, seasonality_notes, nature_topic, audio_url',
    )
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !species) {
    return { contextType: 'species', contextId: slug, title: '物种档案', summary: '该物种不存在或已下架。' }
  }

  const aliases = Array.isArray(species.aliases)
    ? species.aliases.map((item) => compact(String(item), 40)).filter(Boolean).join('、')
    : ''

  const availableAudios: TutorAudioRef[] = []
  const audioRef = mapSpeciesRowToAudioRef({
    slug,
    common_name: species.common_name,
    audio_url: species.audio_url,
  })
  if (audioRef) availableAudios.push(audioRef)

  const summary = [
    `物种：${compact(species.common_name, 80)}`,
    species.scientific_name ? `学名：${compact(species.scientific_name, 80)}` : '',
    species.nature_topic ? `专题：${getSpeciesTopicLabel(species.nature_topic)}` : '',
    species.taxon_group ? `分类：${compact(species.taxon_group, 80)}` : '',
    aliases ? `别名：${aliases}` : '',
    species.identification_notes ? `识别要点：${compact(species.identification_notes, 400)}` : '',
    species.habitat_notes ? `常见环境：${compact(species.habitat_notes, 300)}` : '',
    species.seasonality_notes ? `季节与活动：${compact(species.seasonality_notes, 200)}` : '',
    buildSpeciesPageResourceSummary({
      natureTopic: species.nature_topic,
      audioUrl: species.audio_url,
    }),
    buildAvailableAudiosSummary(availableAudios),
  ]
    .filter(Boolean)
    .join('\n')

  return {
    contextType: 'species',
    contextId: slug,
    title: species.common_name,
    summary,
    sceneCapabilities: availableAudios.length ? ['speciesAudio'] : undefined,
    availableAudios: availableAudios.length ? availableAudios : undefined,
  }
}

async function buildObservationContext(
  supabase: SupabaseClient<Database>,
  userId: string,
  contextId: string,
): Promise<TutorSceneContext> {
  const observationId = Number.parseInt(contextId, 10)
  if (Number.isNaN(observationId)) {
    return { contextType: 'observation', contextId, title: '自然观察', summary: '' }
  }

  const { data: observation } = await supabase
    .from('observation_events')
    .select('user_id, notes, location_name, nature_topic, media_urls, habitat, weather, lifecycle_stage, sex')
    .eq('id', observationId)
    .maybeSingle()

  const { data: speciesRows } = await supabase
    .from('observation_event_species')
    .select('species_id, confidence, species(slug, name, common_name, audio_url)')
    .eq('observation_event_id', observationId)
    .limit(3)

  if (!observation) {
    return { contextType: 'observation', contextId, title: '自然观察', summary: '观察记录不存在。' }
  }

  const speciesText = (speciesRows ?? [])
    .map((row) => {
      const sp = row.species as { name?: string; common_name?: string } | null
      const name = sp?.common_name || sp?.name || '未知物种'
      return `${name}${row.confidence ? `（置信${row.confidence}）` : ''}`
    })
    .join('、')

  const availableAudios = (speciesRows ?? [])
    .map((row) => {
      const sp = row.species as {
        slug?: string
        common_name?: string
        name?: string
        audio_url?: string | null
      } | null
      if (!sp?.slug) return null
      return mapSpeciesRowToAudioRef({
        slug: sp.slug,
        common_name: sp.common_name || sp.name || '未知物种',
        audio_url: sp.audio_url ?? null,
      })
    })
    .filter((item): item is TutorAudioRef => item !== null)

  // 观察记录的文字字段来自学生输入，统一清洗后再进 prompt
  const summary = [
    observation.nature_topic ? `专题：${getSpeciesTopicLabel(observation.nature_topic)}` : '',
    speciesText ? `物种：${speciesText}` : '',
    observation.location_name ? `地点：${sanitizeTutorUGC(observation.location_name, 80)}` : '',
    observation.habitat ? `生境：${sanitizeTutorUGC(observation.habitat, 80)}` : '',
    observation.weather ? `天气：${sanitizeTutorUGC(observation.weather, 40)}` : '',
    observation.lifecycle_stage ? `生命阶段：${observation.lifecycle_stage}` : '',
    observation.sex ? `性别：${observation.sex}` : '',
    observation.notes ? `记录：${sanitizeTutorUGC(observation.notes, 400)}` : '',
    '【学生页面上有】观察照片、地点/生境/天气等记录字段、鉴定和评论区。需要看图时可以提醒学生把页面上的观察照片发给小迪。',
    buildAvailableAudiosSummary(availableAudios),
  ]
    .filter(Boolean)
    .join('\n')

  // 仅本人的观察照片可一键发给小迪（图片归属校验要求当前用户上传）
  const isOwner = observation.user_id === userId

  return {
    contextType: 'observation',
    contextId,
    title: speciesText || '自然观察',
    summary,
    suggestedImages: isOwner ? (observation.media_urls ?? []).slice(0, 4) : undefined,
    sceneCapabilities: availableAudios.length ? ['speciesAudio'] : undefined,
    availableAudios: availableAudios.length ? availableAudios : undefined,
  }
}

async function buildCourseContext(
  supabase: SupabaseClient<Database>,
  userId: string,
  contextId: string,
  lessonId?: number,
  lessonStepIndex?: number,
  scratchBlockTargetItemIndex?: number,
  scratchEditorContext?: ScratchEditorContext,
): Promise<TutorSceneContext> {
  const courseId = Number.parseInt(contextId, 10)
  if (Number.isNaN(courseId)) {
    return { contextType: 'course', contextId, title: '技能课程', summary: '' }
  }

  const classificationSettings = await getContentClassificationSettings()
  let courseQuery = supabase
    .from('courses')
    .select('title, description, tags, status, recommended_min_age, recommended_max_age, support_level, classification_status, classification_source, classification_reviewed_at, classification_reviewed_by, classification_revision, difficulty_stars')
    .eq('id', courseId)
    .eq('status', 'approved')
  if (classificationSettings.enforcementEnabled) {
    courseQuery = courseQuery.eq('classification_status', 'reviewed')
  }

  const [{ data: course }, { data: lessons }, { data: progress }, currentLessonResult] = await Promise.all([
    courseQuery.maybeSingle(),
    supabase
      .from('course_lessons')
      .select('id, title, lesson_type')
      .eq('course_id', courseId)
      .order('sort_order', { ascending: true })
      .limit(20),
    supabase
      .from('user_lesson_progress')
      // 内联课时表按课程过滤，避免把学生所有课程的进度整表拉回来
      .select('lesson_id, completed_at, course_lessons!inner(course_id)')
      .eq('user_id', userId)
      .eq('course_lessons.course_id', courseId)
      .limit(100),
    typeof lessonId === 'number'
      ? supabase
          .from('course_lessons')
          .select('id, title, content, steps')
          .eq('id', lessonId)
          .eq('course_id', courseId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const completedSet = new Set(
    (progress ?? []).filter((p) => p.completed_at).map((p) => p.lesson_id),
  )

  const lessonLines = (course ? lessons ?? [] : [])
    .map((lesson, i) => {
      const done = completedSet.has(lesson.id)
      const marker = lesson.id === lessonId ? '👉 ' : ''
      return `${marker}第${i + 1}课「${compact(lesson.title, 40)}」${done ? '✓' : '○'}`
    })
    .join('\n')

  // 课时学习页：注入当前课时目标与步骤，让小迪能按步骤点拨 Scratch 操作
  const currentLesson = course ? currentLessonResult?.data as
    | { id: number; title: string; content: LessonContent | null; steps: unknown }
    | null : null
  let currentLessonText = ''
  let scratchBlockKeywords: string[] = []
  let scratchBlockItems: ScratchBlockHintItem[] = []
  let existingScratchBlockItems: ScratchBlockHintItem[] = []
  let allScratchBlockItemCount = 0
  let targetScratchBlockIndex: number | undefined
  let scratchBlockCategory: ReturnType<typeof resolveScratchBlockCategory> = undefined
  if (currentLesson) {
    const lessonContent = (currentLesson.content ?? {}) as LessonContent
    const steps = (Array.isArray(currentLesson.steps) ? currentLesson.steps : []) as CourseLessonStep[]
    const currentStep =
      typeof lessonStepIndex === 'number' && steps[lessonStepIndex]
        ? steps[lessonStepIndex]
        : null
    const currentStepNumber = typeof lessonStepIndex === 'number' ? lessonStepIndex + 1 : null
    const allScratchBlockItems = buildScratchBlockHintItems({
      step: currentStep,
      lessonContent,
    })
    allScratchBlockItemCount = allScratchBlockItems.length
    const filteredScratchBlocks = filterScratchBlockItemsByExistingBlocks(allScratchBlockItems, scratchEditorContext)
    scratchBlockItems = filteredScratchBlocks.pendingItems
    existingScratchBlockItems = filteredScratchBlocks.existingItems
    scratchBlockKeywords = [...new Set(scratchBlockItems.map((item) => item.findLabel).filter(Boolean))]
    scratchBlockCategory = resolveScratchBlockCategory(scratchBlockKeywords)
    targetScratchBlockIndex = resolvePendingScratchTargetItemIndex({
      requestedIndex: scratchBlockTargetItemIndex,
      allItemCount: allScratchBlockItems.length,
      pendingOriginalIndexes: filteredScratchBlocks.pendingOriginalIndexes,
    })
    const scratchBlockReferenceLines = formatScratchBlockReferenceItems(scratchBlockItems, targetScratchBlockIndex)
    const stepLines = steps
      .slice(0, 8)
      .map((step, i) => `第${i + 1}步「${compactLessonText(step.title, 40)}」：${compactScratchStepText(step.description, 160)}`)
      .join('\n')
    currentLessonText = [
      `当前课时：${compactLessonText(currentLesson.title, 80)}`,
      typeof lessonContent.summary === 'string' && lessonContent.summary
        ? `课时目标：${compactLessonText(lessonContent.summary, 200)}`
        : '',
      allScratchBlockItemCount > scratchBlockItems.length && scratchBlockItems.length > 0
        ? `当前步骤原本有 ${allScratchBlockItemCount} 个 Scratch 动作；其中 ${allScratchBlockItemCount - scratchBlockItems.length} 个已经出现在当前角色上，页面现在只提示剩下的 ${scratchBlockItems.length} 个。`
        : '',
      currentStep && currentStepNumber != null
        ? `学生当前停在第${currentStepNumber}步「${compactLessonText(currentStep.title, 40)}」。他问下一步或卡住时，优先围绕这一当前步骤，不要跳回第1步。`
        : '',
      typeof targetScratchBlockIndex === 'number' && scratchBlockItems.length > 1
        ? `当前步骤含 ${scratchBlockItems.length} 个 Scratch 动作，页面正提示第 ${targetScratchBlockIndex + 1} 个；本次回复先讲标成“当前要做”的动作，不要直接跳到下一课时步骤。`
        : '',
      formatScratchEditorContext(scratchEditorContext),
      existingScratchBlockItems.length > 0
        ? `当前选中对象已经有这些本步骤相关积木：${existingScratchBlockItems.map((item) => item.findLabel).join('、')}；页面工具只提示还没看到的积木。`
        : '',
      scratchBlockReferenceLines
        ? `当前步骤可直接引用的 Scratch 积木标记（回答时优先照抄标记，不要手写颜色）：\n${scratchBlockReferenceLines}`
        : '',
      stepLines ? `课时步骤（编号和标题必须照抄）：\n${stepLines}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }

  const lessonGameKey =
    currentLesson && typeof (currentLesson.content as LessonContent | null)?.playground?.gameKey === 'string'
      ? (currentLesson.content as LessonContent).playground?.gameKey
      : null

  const summary = [
    course ? `课程：${compact(course.title, 120)}` : '',
    (() => {
      const classification = course
        ? mapPublicClassification(course as unknown as ContentClassificationRow)
        : null
      return classification
        ? `适龄：${classification.ageLabel}\n难度：${classification.difficultyLabel}\n成人支持：${classification.supportLabel}`
        : ''
    })(),
    course?.description ? `简介：${compact(course.description, 300)}` : '',
    shouldInjectGomokuFacts({
      courseTitle: course?.title,
      courseTags: course?.tags,
      lessonGameKey,
    })
      ? GOMOKU_TUTOR_FACTS
      : '',
    currentLessonText,
    lessonLines ? `进度：\n${lessonLines}` : '',
    compactLines([
      '【学生页面上有】技能课程课表和学习进度。',
      currentLesson
        ? `当前课时页面还有 Scratch 工作区和课时步骤；${buildStepReferenceInstruction('课时步骤')}讲操作时让学生对照页面里的步骤标题和编辑器。`
        : null,
    ]),
  ]
    .filter(Boolean)
    .join('\n')

  return {
    contextType: 'course',
    contextId,
    title: currentLesson?.title ?? course?.title ?? '技能课程',
    summary,
    scratchBlockKeywords,
    scratchBlockItems,
    scratchBlockCategory,
    scratchBlockTargetItemIndex: targetScratchBlockIndex,
    scratchBlockStepItemCount: allScratchBlockItemCount,
    scratchEditorContext,
    sceneCapabilities: resolveDefaultSceneCapabilities({ contextType: 'course', lessonId }),
  }
}
