import type { SupabaseClient } from '@supabase/supabase-js'

import type { TutorGlobalSurface, TutorSceneContext } from '@/lib/ai/tutor/types'
import { getStageProgressByUser } from '@/lib/api/challenge-stage-progress'
import type { CourseLessonStep, LessonContent } from '@/lib/courses/types'
import { getHomepageRecommendations } from '@/lib/home/recommendations'
import type { ChallengeStage } from '@/lib/mappers/types'
import type { Database } from '@/lib/supabase/types'

function compact(value: string | null | undefined, max = 400) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export async function buildTutorSceneContext(
  supabase: SupabaseClient<Database>,
  userId: string,
  contextType: TutorSceneContext['contextType'],
  contextId: string,
  options?: {
    stageIndex?: number
    lessonId?: number
    surface?: TutorGlobalSurface
    includeRecommendations?: boolean
  },
): Promise<TutorSceneContext> {
  switch (contextType) {
    case 'challenge':
      return buildChallengeContext(supabase, userId, contextId, options?.stageIndex)
    case 'project':
      return buildProjectContext(supabase, contextId)
    case 'observation':
      return buildObservationContext(supabase, userId, contextId)
    case 'course':
      return buildCourseContext(supabase, userId, contextId, options?.lessonId)
    default:
      return buildGlobalContext(options?.includeRecommendations ?? false, options?.surface)
  }
}

/** global 场景按页面给出不同的标题（面板副标题「正在陪你：…」）与给模型的场景描述 */
const GLOBAL_SURFACE_SCENES: Record<TutorGlobalSurface, { title: string; summary: string }> = {
  home: {
    title: 'STEAM 探索',
    summary: '学生正在浏览首页，可能想寻找下一步学习方向。',
  },
  explore: {
    title: '挑选新项目',
    summary: '学生正在逛项目库找动手项目，可以按他的兴趣和水平帮他挑选。',
  },
  nature: {
    title: '自然观察',
    summary: '学生正在逛自然观察频道（鸟类、昆虫、树木等专题），可以引导他开始或继续一次自然观察。',
  },
  create: {
    title: '挑战与训练营',
    summary: '学生正在创造营浏览 PBL 挑战和 Scratch 训练营，可以帮他挑一个合适的开始。',
  },
  courses: {
    title: 'Scratch 训练营',
    summary: '学生正在看 Scratch 训练营课程列表，可能想学编程做游戏和动画。',
  },
  community: {
    title: '逛社区',
    summary: '学生正在逛社区讨论区，看同学们的帖子和分享。',
  },
  playground: {
    title: '益智游乐场',
    summary: '学生正在益智游乐场（2048、数独、五子棋、扫雷等小游戏），可以聊聊游戏里的数学和策略。',
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

async function buildGlobalContext(
  includeRecommendations: boolean,
  surface?: TutorGlobalSurface,
): Promise<TutorSceneContext> {
  const scene = GLOBAL_SURFACE_SCENES[surface ?? 'home'] ?? GLOBAL_SURFACE_SCENES.home
  const base: TutorSceneContext = {
    contextType: 'global',
    contextId: '',
    title: scene.title,
    summary: scene.summary,
    surface,
  }

  // 开场白（GET）不查推荐，只有真正对话（POST）才注入候选项目，控制查询成本。
  if (!includeRecommendations) return base

  try {
    const { projects } = await getHomepageRecommendations({ limit: 6 })
    if (!projects.length) return base

    const lines = projects
      .map((project) => {
        const detail = [project.category, project.difficulty_stars ? `${project.difficulty_stars}星` : '']
          .filter(Boolean)
          .join('·')
        return `- [project:${project.id}|${compact(project.title, 40)}]${detail ? `（${detail}）` : ''}`
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
    return { contextType: 'challenge', contextId, title: 'PBL 挑战', summary: '' }
  }

  const { data: challenge } = await supabase
    .from('challenges')
    .select('title, driving_question, constraints, stages')
    .eq('id', challengeId)
    .maybeSingle()

  if (!challenge) {
    return { contextType: 'challenge', contextId, title: 'PBL 挑战', summary: '挑战不存在或已下架。' }
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

  const progressList = await getStageProgressByUser(supabase, challengeId, userId)
  const progressByIndex = new Map(progressList.map((item) => [item.stageIndex, item]))
  const progressSummary = stages
    .map((s, i) => {
      const p = progressByIndex.get(i)
      const status = STATUS_LABEL[p?.status ?? 'not_started'] ?? '未开始'
      const parts: string[] = []
      if (p?.notes?.trim()) parts.push(p.notes.trim())
      if (typeof p?.data?.summary === 'string' && p.data.summary.trim()) parts.push(`数据：${p.data.summary.trim()}`)
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
    progressSummary ? `\n【各阶段产出】\n${compact(progressSummary, 1400)}` : '',
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

  const { data: project } = await supabase
    .from('projects')
    .select('title, description, category, difficulty_stars, problem_statement, reflection, tags')
    .eq('id', projectId)
    .maybeSingle()

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

  const stepSummary = (steps ?? [])
    .map((step, i) => `第${i + 1}步 ${compact(step.title ?? '步骤', 40)}：${compact(step.description, 100)}`)
    .join('\n')

  const materialText = (materials ?? [])
    .map((m) => compact(m.material, 40))
    .filter(Boolean)
    .join('、')

  const summary = [
    `项目：${compact(project.title, 120)}`,
    project.category ? `分类：${project.category}` : '',
    project.difficulty_stars ? `难度：${project.difficulty_stars} 星` : '',
    project.description ? `简介：${compact(project.description, 300)}` : '',
    project.problem_statement ? `问题：${compact(project.problem_statement, 200)}` : '',
    materialText ? `材料：${materialText}` : '',
    stepSummary ? `步骤概览：\n${stepSummary}` : '',
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
    .select('species_id, confidence, species(name, common_name)')
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

  const summary = [
    observation.nature_topic ? `专题：${observation.nature_topic}` : '',
    speciesText ? `物种：${speciesText}` : '',
    observation.location_name ? `地点：${observation.location_name}` : '',
    observation.habitat ? `生境：${compact(observation.habitat, 80)}` : '',
    observation.weather ? `天气：${compact(observation.weather, 40)}` : '',
    observation.lifecycle_stage ? `生命阶段：${observation.lifecycle_stage}` : '',
    observation.sex ? `性别：${observation.sex}` : '',
    observation.notes ? `记录：${compact(observation.notes, 400)}` : '',
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
  }
}

async function buildCourseContext(
  supabase: SupabaseClient<Database>,
  userId: string,
  contextId: string,
  lessonId?: number,
): Promise<TutorSceneContext> {
  const courseId = Number.parseInt(contextId, 10)
  if (Number.isNaN(courseId)) {
    return { contextType: 'course', contextId, title: '训练营', summary: '' }
  }

  const [{ data: course }, { data: lessons }, { data: progress }, currentLessonResult] = await Promise.all([
    supabase.from('courses').select('title, description').eq('id', courseId).maybeSingle(),
    supabase
      .from('course_lessons')
      .select('id, title, lesson_type')
      .eq('course_id', courseId)
      .order('sort_order', { ascending: true })
      .limit(20),
    supabase
      .from('user_lesson_progress')
      .select('lesson_id, completed_at')
      .eq('user_id', userId),
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

  const lessonLines = (lessons ?? [])
    .map((lesson, i) => {
      const done = completedSet.has(lesson.id)
      const marker = lesson.id === lessonId ? '👉 ' : ''
      return `${marker}第${i + 1}课「${compact(lesson.title, 40)}」${done ? '✓' : '○'}`
    })
    .join('\n')

  // 课时学习页：注入当前课时目标与步骤，让小迪能按步骤点拨 Scratch 操作
  const currentLesson = currentLessonResult?.data as
    | { id: number; title: string; content: LessonContent | null; steps: unknown }
    | null
  let currentLessonText = ''
  if (currentLesson) {
    const lessonContent = (currentLesson.content ?? {}) as LessonContent
    const steps = (Array.isArray(currentLesson.steps) ? currentLesson.steps : []) as CourseLessonStep[]
    const stepLines = steps
      .slice(0, 8)
      .map((step, i) => `第${i + 1}步「${compact(step.title, 40)}」：${compact(step.description, 120)}`)
      .join('\n')
    currentLessonText = [
      `当前课时：${compact(currentLesson.title, 80)}`,
      typeof lessonContent.summary === 'string' && lessonContent.summary
        ? `课时目标：${compact(lessonContent.summary, 200)}`
        : '',
      stepLines ? `课时步骤：\n${stepLines}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }

  const summary = [
    course ? `课程：${compact(course.title, 120)}` : '',
    course?.description ? `简介：${compact(course.description, 300)}` : '',
    currentLessonText,
    lessonLines ? `进度：\n${lessonLines}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return {
    contextType: 'course',
    contextId,
    title: currentLesson?.title ?? course?.title ?? '训练营',
    summary,
  }
}
