import type { StageArtifact, StageCoachContext } from '@/lib/ai/pbl-stage-coach'
import type { ChallengeStage, StageProgress } from '@/lib/mappers/types'
import type { ChallengeWorkspace } from '@/lib/pbl/challenge-workspace'

type ChallengeForStageReview = {
  title: string
  drivingQuestion?: string | null
  constraints?: string[] | null
}

const STATUS_LABEL: Record<string, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  completed: '已完成',
}

function compact(value: string | null | undefined, max = 400) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max)}...` : text
}

function toCheckedIndexes(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is number => Number.isInteger(item) && item >= 0).slice(0, 12)
}

export function buildStageReviewArtifact(input: {
  notes?: string | null
  images?: string[] | null
  data?: Record<string, unknown> | null
  stage?: ChallengeStage | null
}): StageArtifact {
  const parts: string[] = []
  const notes = compact(input.notes, 4000)
  if (notes) parts.push(notes)

  const summary = typeof input.data?.summary === 'string' ? compact(input.data.summary, 1200) : ''
  if (summary) parts.push(`关键数据 / 补充记录：${summary}`)

  const checkedIndexes = toCheckedIndexes(input.data?.checked)
  const checklist = Array.isArray(input.stage?.checklist) ? input.stage.checklist : []
  const checkedLabels = checkedIndexes
    .map((index) => checklist[index])
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)

  if (checkedLabels.length > 0) {
    parts.push(`已勾选完成清单：${checkedLabels.join('；')}`)
  } else if (checkedIndexes.length > 0) {
    parts.push(`已勾选完成清单：${checkedIndexes.length} 项`)
  }

  return {
    notes: parts.join('\n') || null,
    imageUrls: (input.images ?? []).filter((image): image is string => typeof image === 'string' && image.length > 0),
  }
}

export function buildStageProgressSummary(input: {
  stages: ChallengeStage[]
  progressList: StageProgress[]
  currentStageIndex: number
  workspace?: ChallengeWorkspace | null
}) {
  const progressByIndex = new Map(input.progressList.map((item) => [item.stageIndex, item]))
  const personalStep = input.workspace?.personalPlan?.steps.find((item) => item.stageIndex === input.currentStageIndex)

  const header = [
    input.workspace?.projectGoal ? `学生自己的项目方向：${compact(input.workspace.projectGoal, 180)}` : '',
    personalStep
      ? `当前阶段个人化提示：${compact(personalStep.focus, 180)} ${compact(personalStep.evidencePrompt, 160)} ${compact(personalStep.checkpointPrompt, 160)}`
      : '',
  ].filter(Boolean)

  const stageLines = input.stages.map((stage, index) => {
    const progress = progressByIndex.get(index)
    const status = STATUS_LABEL[progress?.status ?? 'not_started'] ?? '未开始'
    const bodyParts: string[] = []

    if (progress?.notes?.trim()) bodyParts.push(compact(progress.notes, 260))
    if (typeof progress?.data?.summary === 'string' && progress.data.summary.trim()) {
      bodyParts.push(`数据：${compact(progress.data.summary, 180)}`)
    }
    if (progress?.images?.length) bodyParts.push(`（${progress.images.length} 张图片）`)

    const marker = index === input.currentStageIndex ? '当前 ' : ''
    const body = bodyParts.length > 0 ? bodyParts.join(' ') : '（暂无记录）'
    return `${marker}第${index + 1}步「${compact(stage.title, 80)}」[${status}]：${body}`
  })

  return [...header, '【各阶段产出】', ...stageLines].filter(Boolean).join('\n')
}

export function buildStageReviewContext(input: {
  challenge: ChallengeForStageReview
  stages: ChallengeStage[]
  stageIndex: number
  progressList: StageProgress[]
  workspace?: ChallengeWorkspace | null
}): StageCoachContext {
  const stage = input.stages[input.stageIndex]
  return {
    challengeTitle: input.challenge.title,
    drivingQuestion: input.challenge.drivingQuestion ?? null,
    constraints: input.challenge.constraints ?? null,
    stageTitle: stage?.title || `阶段 ${input.stageIndex + 1}`,
    stageDescription: stage?.description || '',
    stageHint: stage?.hint ?? null,
    stageKind: stage?.kind ?? 'generic',
    currentStageIndex: input.stageIndex,
    totalStages: input.stages.length,
    progressSummary: buildStageProgressSummary({
      stages: input.stages,
      progressList: input.progressList,
      currentStageIndex: input.stageIndex,
      workspace: input.workspace,
    }),
  }
}
