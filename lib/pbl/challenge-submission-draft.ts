import type { ChallengeStage, StageAiFeedback, StageProgress } from '@/lib/mappers/types'
import type { ChallengeWorkspace } from '@/lib/pbl/challenge-workspace'

export type ChallengeDraftSteamInsight = {
  key: 'S' | 'T' | 'E' | 'A' | 'M'
  label: string
  evidence: string
}

export type ChallengeSubmissionDraft = {
  title: string
  notes: string
  images: string[]
  steamInsights: ChallengeDraftSteamInsight[]
  source: 'local' | 'ai'
}

export type ChallengeForSubmissionDraft = {
  title: string
  drivingQuestion?: string | null
  expectedOutcome?: string | null
  constraints?: string[] | null
  steamWeights?: Record<string, unknown> | null
}

type StageDraftEntry = {
  index: number
  title: string
  kind: ChallengeStage['kind']
  status: StageProgress['status']
  notes: string
  dataSummary: string
  checkedLabels: string[]
  feedback: StageAiFeedback | null
  images: string[]
}

const STEAM_LABELS: Record<ChallengeDraftSteamInsight['key'], string> = {
  S: '科学',
  T: '技术',
  E: '工程',
  A: '艺术',
  M: '数学',
}

const STEAM_KIND_FALLBACK: Record<NonNullable<ChallengeStage['kind']>, ChallengeDraftSteamInsight['key'][]> = {
  observe: ['S'],
  design: ['E', 'A'],
  build_test: ['E', 'T', 'S'],
  iterate: ['M', 'E'],
  generic: ['E'],
}

function compact(value: string | null | undefined, max = 500) {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max)}...` : text
}

function compactMultiline(value: string | null | undefined, max = 5000) {
  const text = typeof value === 'string'
    ? value
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    : ''
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max)}...` : text
}

function uniqueStrings(values: string[], max = 9) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(value)
    if (result.length >= max) break
  }
  return result
}

function getStageDataSummary(data: Record<string, unknown> | null | undefined) {
  return typeof data?.summary === 'string' ? compact(data.summary, 700) : ''
}

function getCheckedLabels(stage: ChallengeStage | undefined, data: Record<string, unknown> | null | undefined) {
  if (!Array.isArray(data?.checked) || !Array.isArray(stage?.checklist)) return []
  return uniqueStrings(
    data.checked
      .filter((item): item is number => Number.isInteger(item) && item >= 0)
      .map((index) => stage.checklist?.[index])
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => compact(item, 80)),
    8,
  )
}

function normalizeSteamWeightKey(key: string): ChallengeDraftSteamInsight['key'] | null {
  const normalized = key.trim().toUpperCase()
  return normalized === 'S' || normalized === 'T' || normalized === 'E' || normalized === 'A' || normalized === 'M'
    ? normalized
    : null
}

function getDominantSteamKeys(
  weights: Record<string, unknown> | null | undefined,
  stages: StageDraftEntry[],
) {
  const weighted = Object.entries(weights ?? {})
    .map(([key, value]) => {
      const normalizedKey = normalizeSteamWeightKey(key)
      const score = typeof value === 'number' ? value : Number(value)
      return normalizedKey && Number.isFinite(score) && score > 0 ? { key: normalizedKey, score } : null
    })
    .filter((item): item is { key: ChallengeDraftSteamInsight['key']; score: number } => Boolean(item))
    .sort((a, b) => b.score - a.score)

  const result = weighted.map((item) => item.key)
  for (const stage of stages) {
    for (const key of STEAM_KIND_FALLBACK[stage.kind ?? 'generic']) {
      result.push(key)
    }
  }

  return uniqueStrings(result, 3) as ChallengeDraftSteamInsight['key'][]
}

function buildStageEntries(stages: ChallengeStage[], progressList: StageProgress[]) {
  const progressByIndex = new Map(progressList.map((item) => [item.stageIndex, item]))
  return stages.map((stage, index): StageDraftEntry => {
    const progress = progressByIndex.get(index)
    return {
      index,
      title: compact(stage.title, 120) || `阶段 ${index + 1}`,
      kind: stage.kind ?? 'generic',
      status: progress?.status ?? 'not_started',
      notes: compact(progress?.notes, 900),
      dataSummary: getStageDataSummary(progress?.data),
      checkedLabels: getCheckedLabels(stage, progress?.data),
      feedback: progress?.aiFeedback ?? null,
      images: progress?.images ?? [],
    }
  })
}

function stageHasEvidence(stage: StageDraftEntry) {
  return Boolean(stage.notes || stage.dataSummary || stage.checkedLabels.length > 0 || stage.images.length > 0)
}

function firstEvidence(stage: StageDraftEntry) {
  if (stage.dataSummary) return stage.dataSummary
  if (stage.notes) return stage.notes
  if (stage.checkedLabels.length > 0) return `完成了${stage.checkedLabels.join('、')}`
  if (stage.images.length > 0) return `保留了 ${stage.images.length} 张过程图片`
  return ''
}

function buildLocalTitle(challenge: ChallengeForSubmissionDraft, workspace?: ChallengeWorkspace | null) {
  const goal = compact(workspace?.projectGoal, 40)
  if (goal) return goal
  return `${compact(challenge.title, 56) || '挑战作品'}记录`
}

function buildProjectDescription(input: {
  challenge: ChallengeForSubmissionDraft
  workspace?: ChallengeWorkspace | null
  evidenceStages: StageDraftEntry[]
}) {
  const lines = [
    input.workspace?.projectGoal
      ? `我的项目方向是：${compact(input.workspace.projectGoal, 160)}。`
      : `我围绕「${compact(input.challenge.title, 120)}」完成了这份挑战作品。`,
    input.challenge.drivingQuestion
      ? `我重点回应的问题是：${compact(input.challenge.drivingQuestion, 180)}。`
      : '',
    input.challenge.expectedOutcome
      ? `目标产出：${compact(input.challenge.expectedOutcome, 180)}。`
      : '',
  ].filter(Boolean)

  const stageLines = input.evidenceStages.map((stage) => {
    const evidence = firstEvidence(stage)
    return `第 ${stage.index + 1} 步「${stage.title}」：${evidence || '完成了阶段记录'}。`
  })

  return ['【作品说明】', ...lines, ...stageLines].join('\n')
}

function buildReflection(evidenceStages: StageDraftEntry[]) {
  const feedbackGaps = uniqueStrings(
    evidenceStages.flatMap((stage) => stage.feedback?.gaps ?? []).map((item) => compact(item, 90)),
    3,
  )
  const nextActions = uniqueStrings(
    evidenceStages.flatMap((stage) => stage.feedback?.nextActions ?? []).map((item) => compact(item, 90)),
    3,
  )
  const iterateStage = evidenceStages.find((stage) => stage.kind === 'iterate' && (stage.notes || stage.dataSummary))
  const testedStage = evidenceStages.find((stage) => stage.kind === 'build_test' && (stage.notes || stage.dataSummary))

  return [
    '【反思记录】',
    testedStage
      ? `我用「${testedStage.title}」里的记录检查作品效果：${firstEvidence(testedStage)}。`
      : '我通过阶段记录保留了制作过程和证据，后续还可以补充更清楚的测试数据。',
    iterateStage
      ? `迭代时我重点整理了：${firstEvidence(iterateStage)}。`
      : '',
    feedbackGaps.length > 0 ? `还需要改进：${feedbackGaps.join('；')}。` : '',
    nextActions.length > 0 ? `下一步我会：${nextActions.join('；')}。` : '',
  ].filter(Boolean).join('\n')
}

function buildSteamInsights(
  challenge: ChallengeForSubmissionDraft,
  evidenceStages: StageDraftEntry[],
): ChallengeDraftSteamInsight[] {
  const keys = getDominantSteamKeys(challenge.steamWeights, evidenceStages)
  const evidencePool = evidenceStages.filter(stageHasEvidence)

  return keys.map((key, index) => {
    const stage = evidencePool[index % Math.max(evidencePool.length, 1)]
    const evidence = stage
      ? `来自第 ${stage.index + 1} 步「${stage.title}」：${firstEvidence(stage)}。`
      : '来自挑战过程中的观察、设计、测试与迭代记录。'
    return {
      key,
      label: STEAM_LABELS[key],
      evidence: compact(evidence, 180),
    }
  })
}

function buildSteamSection(insights: ChallengeDraftSteamInsight[]) {
  if (insights.length === 0) return ''
  return [
    '【STEAM 能力收获】',
    ...insights.map((item) => `${item.label}：${item.evidence}`),
  ].join('\n')
}

export function buildChallengeSubmissionDraft(input: {
  challenge: ChallengeForSubmissionDraft
  stages: ChallengeStage[]
  progressList: StageProgress[]
  workspace?: ChallengeWorkspace | null
  source?: ChallengeSubmissionDraft['source']
}): ChallengeSubmissionDraft {
  const stageEntries = buildStageEntries(input.stages, input.progressList)
  const evidenceStages = stageEntries.filter(stageHasEvidence)
  const steamInsights = buildSteamInsights(input.challenge, evidenceStages)
  const images = uniqueStrings(evidenceStages.flatMap((stage) => stage.images), 9)
  const notes = [
    buildProjectDescription({ challenge: input.challenge, workspace: input.workspace, evidenceStages }),
    buildReflection(evidenceStages),
    buildSteamSection(steamInsights),
  ].filter(Boolean).join('\n\n')

  return {
    title: buildLocalTitle(input.challenge, input.workspace),
    notes,
    images,
    steamInsights,
    source: input.source ?? 'local',
  }
}

export function normalizeChallengeSubmissionDraft(input: {
  draft: Partial<ChallengeSubmissionDraft>
  fallback: ChallengeSubmissionDraft
}): ChallengeSubmissionDraft {
  const title = compact(input.draft.title, 200) || input.fallback.title
  const notes = compactMultiline(input.draft.notes, 5000) || input.fallback.notes
  const images = uniqueStrings(input.draft.images ?? input.fallback.images, 9)
  const steamInsights = Array.isArray(input.draft.steamInsights)
    ? input.draft.steamInsights
      .map((item) => {
        const key = normalizeSteamWeightKey(String(item.key ?? ''))
        const label = compact(item.label, 20)
        const evidence = compact(item.evidence, 180)
        return key && label && evidence ? { key, label, evidence } : null
      })
      .filter((item): item is ChallengeDraftSteamInsight => Boolean(item))
      .slice(0, 5)
    : input.fallback.steamInsights

  return {
    title,
    notes,
    images,
    steamInsights: steamInsights.length > 0 ? steamInsights : input.fallback.steamInsights,
    source: input.draft.source === 'ai' ? 'ai' : input.fallback.source,
  }
}
