import type { ChallengeStage, ChallengeStageKind } from '@/lib/mappers/types'

export type ChallengePersonalPlanStep = {
  stageIndex: number
  title: string
  focus: string
  evidencePrompt: string
  checkpointPrompt: string
}

export type ChallengePersonalPlan = {
  version: 1
  sourceGoal: string
  generatedAt: string
  stageCount: number
  steps: ChallengePersonalPlanStep[]
}

export type ChallengeWorkspace = {
  projectGoal: string
  personalPlan: ChallengePersonalPlan | null
  updatedAt?: string
}

export type ChallengeWorkspaceRow = {
  project_goal: string
  personal_plan: unknown
  updated_at: string | null
}

export function normalizeProjectGoal(value: string | null | undefined) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function getKindPrompts(kind: ChallengeStageKind | undefined, goal: string) {
  switch (kind) {
    case 'observe':
      return {
        focus: `先围绕「${goal}」确认真实需求、使用场景和限制条件。`,
        evidencePrompt: '记录观察地点、对象、时间和你发现的关键问题。',
        checkpointPrompt: '能说清楚这个目标为什么值得做，以及它要解决谁的什么需要。',
      }
    case 'design':
      return {
        focus: `围绕「${goal}」比较至少两种方案，再选择最适合继续制作的一种。`,
        evidencePrompt: '保留草图、方案对比或材料选择理由。',
        checkpointPrompt: '能解释你为什么选这个方案，以及它如何回应项目目标。',
      }
    case 'build_test':
      return {
        focus: `把「${goal}」做成可测试的原型，并用数据检查它是否有效。`,
        evidencePrompt: '记录测试条件、关键数据、照片和失败现象。',
        checkpointPrompt: '每次测试只改一个主要变量，能判断改动是否真的有帮助。',
      }
    case 'iterate':
      return {
        focus: `对照「${goal}」说明改进前后的差异和你的取舍。`,
        evidencePrompt: '保留前后对比、改动原因和仍想继续优化的地方。',
        checkpointPrompt: '能把改进证据整理成最终作品里的一段反思。',
      }
    default:
      return {
        focus: `围绕「${goal}」完成这一阶段产出，保留能证明过程的材料。`,
        evidencePrompt: '记录你做了什么、看到什么、下一步准备怎么推进。',
        checkpointPrompt: '能用自己的话说明这一步如何帮助项目目标往前走。',
      }
  }
}

function parsePlanStep(value: unknown): ChallengePersonalPlanStep | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (
    typeof item.stageIndex !== 'number' ||
    typeof item.title !== 'string' ||
    typeof item.focus !== 'string' ||
    typeof item.evidencePrompt !== 'string' ||
    typeof item.checkpointPrompt !== 'string'
  ) {
    return null
  }

  return {
    stageIndex: item.stageIndex,
    title: item.title,
    focus: item.focus,
    evidencePrompt: item.evidencePrompt,
    checkpointPrompt: item.checkpointPrompt,
  }
}

export function parseChallengePersonalPlan(value: unknown): ChallengePersonalPlan | null {
  if (!value || typeof value !== 'object') return null
  const plan = value as Record<string, unknown>
  if (
    plan.version !== 1 ||
    typeof plan.sourceGoal !== 'string' ||
    typeof plan.generatedAt !== 'string' ||
    typeof plan.stageCount !== 'number' ||
    !Array.isArray(plan.steps)
  ) {
    return null
  }

  const steps = plan.steps.map(parsePlanStep).filter((step): step is ChallengePersonalPlanStep => Boolean(step))
  return {
    version: 1,
    sourceGoal: plan.sourceGoal,
    generatedAt: plan.generatedAt,
    stageCount: plan.stageCount,
    steps,
  }
}

export function buildChallengePersonalPlan({
  projectGoal,
  stages,
  now = new Date(),
}: {
  projectGoal: string
  stages: ChallengeStage[]
  now?: Date
}): ChallengePersonalPlan | null {
  const normalizedGoal = normalizeProjectGoal(projectGoal)
  if (!normalizedGoal) return null

  return {
    version: 1,
    sourceGoal: normalizedGoal,
    generatedAt: now.toISOString(),
    stageCount: stages.length,
    steps: stages.map((stage, index) => {
      const prompts = getKindPrompts(stage.kind, normalizedGoal)
      return {
        stageIndex: index,
        title: stage.title || `阶段 ${index + 1}`,
        ...prompts,
      }
    }),
  }
}

export function mapChallengeWorkspace(row: ChallengeWorkspaceRow): ChallengeWorkspace {
  return {
    projectGoal: row.project_goal,
    personalPlan: parseChallengePersonalPlan(row.personal_plan),
    updatedAt: row.updated_at ?? undefined,
  }
}
