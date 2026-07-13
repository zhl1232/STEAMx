import { chatWithTutorComplete } from '@/lib/ai/tutor/engine'
import type { TutorToolReason } from '@/lib/ai/tutor/tool-calls'
import {
  buildTutorToolCallsFromPlan,
  getAvailableTutorTools,
  type ToolAvailabilityInput,
  type TutorPlannerToolSelection,
} from '@/lib/ai/tutor/tool-registry'

type PlannerInput = ToolAvailabilityInput & {
  content: string
}

type PlannerDecision = {
  reason?: TutorToolReason
  selections: TutorPlannerToolSelection[]
}

const PROGRESS_PAGE_ACTION_RE =
  /(?:下一步|继续(?:做|吧|呢|推进)?|卡住|不会(?:做)?|做不出来|帮我(?:找|看|检查|核对|高亮|定位|打开))/u

const SCRATCH_LOCATE_PAGE_ACTION_RE =
  /(?:(?:找|定位|高亮|打开|检查|核对).{0,12}(?:积木|步骤|分类)|(?:积木|步骤|分类).{0,12}(?:在哪|在哪里|找不到|怎么找|高亮|打开))/u

const COMPLETION_PAGE_ACTION_RE = /(?:做好|做完|完成|拖好|加好|写好|放好)(?:了|啦|!|！|。|$)/u

const CHALLENGE_REVIEW_PAGE_ACTION_RE = /(?:(?:看|检查).{0,12}(?:这一步|当前|阶段|做得)|反馈)/u

const MINESWEEPER_PAGE_ACTION_RE =
  /(?:卡住|(?:给|要|来点).{0,4}(?:提示|线索)|(?:帮我)?(?:看|看看).{0,6}(?:棋盘|这一局|这局|当前|哪(?:一)?格|哪个格|哪格)|哪(?:一)?格|哪个格|哪格|能确定|下一步|怎么点|(?:这|当前).{0,4}(?:格|方块).{0,6}(?:安全|是雷))/u

function compact(value: string, max = 160) {
  const text = value.trim()
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function clampIndex(value: number, max: number) {
  return Math.min(Math.max(Math.trunc(value), 0), max)
}

function hasTutorPageActionIntent(input: PlannerInput) {
  const content = input.content.trim().replace(/\s+/g, '')
  if (!content) return false

  if (input.contextType === 'global') {
    return MINESWEEPER_PAGE_ACTION_RE.test(content)
  }

  const isProgressAction =
    PROGRESS_PAGE_ACTION_RE.test(content) ||
    COMPLETION_PAGE_ACTION_RE.test(content)
  if (input.contextType === 'course') {
    return isProgressAction || SCRATCH_LOCATE_PAGE_ACTION_RE.test(content)
  }

  return isProgressAction || CHALLENGE_REVIEW_PAGE_ACTION_RE.test(content)
}

function buildScratchStateSummary(input: PlannerInput) {
  const items = (input.scratchBlockItems ?? []).slice(0, 4)
  const keywords = (input.scratchBlockKeywords ?? []).slice(0, 4)
  const itemCount = Math.max(items.length, keywords.length)
  const originalItemCount =
    typeof input.scratchBlockStepItemCount === 'number' && input.scratchBlockStepItemCount > 0
      ? input.scratchBlockStepItemCount
      : itemCount
  const currentIndex =
    typeof input.scratchBlockTargetItemIndex === 'number' && Number.isFinite(input.scratchBlockTargetItemIndex)
      ? clampIndex(input.scratchBlockTargetItemIndex, Math.max(itemCount - 1, 0))
      : undefined

  if (itemCount === 0) {
    return originalItemCount > 0
      ? [
          `Scratch 原始子动作数：${originalItemCount}`,
          '当前待提示 Scratch 子动作数：0',
          '页面已经识别当前步骤里的 Scratch 子动作都在作品中出现；如果用户明确要继续推进，通常只需要聚焦下一课时步骤，不要再高亮 Scratch 积木。',
        ].join('\n')
      : ''
  }

  const lines = (items.length > 0 ? items : keywords.map((keyword) => ({ findLabel: keyword }))).map((item, index) => {
    const state =
      index === currentIndex ? '当前高亮' : typeof currentIndex === 'number' && index < currentIndex ? '已完成' : '未开始'
    const category = 'category' in item && item.category ? `分类:${item.category}` : ''
    const editHint = 'editHint' in item && item.editHint ? `编辑:${item.editHint}` : ''
    return `- ${index + 1}. ${item.findLabel}（${[state, category, editHint].filter(Boolean).join('；')}）`
  })

  return [
    `Scratch 原始子动作数：${originalItemCount}`,
    `当前待提示 Scratch 子动作数：${itemCount}`,
    `当前子动作索引：${typeof currentIndex === 'number' ? currentIndex : '无'}`,
    input.scratchBlockCategory ? `默认分类：${input.scratchBlockCategory}` : '',
    'Scratch 子动作列表：',
    ...lines,
  ]
    .filter(Boolean)
    .join('\n')
}

function buildPlannerPrompt(input: PlannerInput) {
  const availableTools = getAvailableTutorTools(input)
  const toolLines = availableTools
    .map((tool) => {
      return [
        `- ${tool.name}`,
        `  用途：${tool.description}`,
        `  什么时候用：${tool.whenToUse}`,
        `  参数：${tool.payloadShape}`,
      ].join('\n')
    })
    .join('\n')

  return [
    '你是一个前端教学助手的工具决策器。你不写教学回答，只判断当前是否需要触发页面工具。',
    '只输出一行 JSON，不要输出解释。',
    '输出格式：{"reason":"stuck|next_step|review","selections":[{"name":"工具名","reason":"...","stepIndex":0,"targetItemIndex":0}]}',
    '规则：',
    '1. 只有当用户这句话明显需要页面动作时，才返回 selections；否则返回 {"selections":[]}',
    '2. 只能从“当前可用工具”里选工具，不能自造工具名。',
    '3. PBL 里用户卡住、要下一步、想看反馈时，通常选 pbl.focus_current_stage。',
    '4. 课程里用户卡住、要下一步、想检查当前步骤时，通常要先选 course.focus_lesson_step。',
    '5. Scratch 当前步骤有多个子动作时：',
    '   - 如果用户是在确认当前高亮的动作已经做完，而且还有下一个子动作，选 course.focus_lesson_step + course.highlight_scratch_blocks，并把 targetItemIndex 切到下一个子动作。',
    '   - 如果当前待提示 Scratch 子动作数为 0，且用户明确要继续推进，选 course.focus_lesson_step，并把 stepIndex 切到下一课时步骤。',
    '   - 只有当前步骤最后一个子动作也完成后，才把 course.focus_lesson_step 的 stepIndex 切到下一课时步骤。',
    '6. 如果只是继续停在当前步骤讲解，可保留当前 stepIndex；需要高亮某个 Scratch 子动作时，带上 targetItemIndex。',
    '7. 扫雷页里学生明确要提示、问哪格安全/哪格是雷、或表示卡住时，选 playground.hint_minesweeper；普通扫雷知识问答不触发。',
    '',
    `用户消息：${compact(input.content, 260) || '（空）'}`,
    `场景：${input.contextType}`,
    typeof input.stageIndex === 'number' ? `当前阶段索引：${input.stageIndex}` : '',
    typeof input.lessonId === 'number' ? `当前课时 ID：${input.lessonId}` : '',
    typeof input.lessonStepIndex === 'number' ? `当前课时步骤索引：${input.lessonStepIndex}` : '',
    typeof input.lessonStepCount === 'number' ? `课时总步数：${input.lessonStepCount}` : '',
    buildScratchStateSummary(input),
    '',
    '当前可用工具：',
    toolLines || '- 无',
    '',
    '无动作示例：{"selections":[]}',
    'Scratch 下一子动作示例：{"reason":"next_step","selections":[{"name":"course.focus_lesson_step","reason":"next_step","stepIndex":2},{"name":"course.highlight_scratch_blocks","reason":"next_step","stepIndex":2,"targetItemIndex":1}]}',
    'PBL 反馈示例：{"reason":"review","selections":[{"name":"pbl.focus_current_stage","reason":"review"}]}',
    '扫雷提示示例：{"reason":"stuck","selections":[{"name":"playground.hint_minesweeper","reason":"stuck"}]}',
  ]
    .filter(Boolean)
    .join('\n')
}

function parsePlannerDecision(raw: string, input: PlannerInput): PlannerDecision | null {
  const text = raw.trim()
  if (!text) return null
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null

  const availableTools = new Set(getAvailableTutorTools(input).map((tool) => tool.name))

  try {
    const parsed = JSON.parse(match[0]) as {
      reason?: unknown
      selections?: Array<{
        name?: unknown
        reason?: unknown
        stepIndex?: unknown
        targetItemIndex?: unknown
      }>
    }

    const topReason =
      parsed.reason === 'stuck' || parsed.reason === 'next_step' || parsed.reason === 'review'
        ? parsed.reason
        : undefined

    const rawSelections = Array.isArray(parsed.selections) ? parsed.selections : []
    const selections: TutorPlannerToolSelection[] = []

    for (const item of rawSelections.slice(0, 4)) {
      const name = item?.name
      const reason =
        item?.reason === 'stuck' || item?.reason === 'next_step' || item?.reason === 'review'
          ? item.reason
          : topReason
      if (
        (name !== 'pbl.focus_current_stage' &&
          name !== 'course.focus_lesson_step' &&
          name !== 'course.highlight_scratch_blocks' &&
          name !== 'playground.hint_minesweeper') ||
        !availableTools.has(name) ||
        !reason
      ) {
        continue
      }

      const selection: TutorPlannerToolSelection = {
        name,
        reason,
      }
      if (typeof item.stepIndex === 'number' && Number.isFinite(item.stepIndex)) {
        selection.stepIndex = Math.max(Math.trunc(item.stepIndex), 0)
      }
      if (typeof item.targetItemIndex === 'number' && Number.isFinite(item.targetItemIndex)) {
        selection.targetItemIndex = Math.max(Math.trunc(item.targetItemIndex), 0)
      }
      selections.push(selection)
    }

    return {
      reason: topReason,
      selections,
    }
  } catch {
    return null
  }
}

export async function planTutorToolDecision(input: PlannerInput) {
  const availableTools = getAvailableTutorTools(input)
  // This only avoids invoking the planner for ordinary Q&A. Tool selection remains model-planned and registry-validated.
  if (availableTools.length === 0 || !hasTutorPageActionIntent(input)) return null

  const reply = await chatWithTutorComplete(buildPlannerPrompt(input), [
    {
      role: 'user',
      content: input.content || '请判断当前是否需要触发页面工具。',
    },
  ], { modelMode: 'planner' })

  const decision = parsePlannerDecision(reply, input)
  if (!decision) return null

  const toolCalls = buildTutorToolCallsFromPlan({
    ...input,
    availableTools,
    selections: decision.selections,
  })

  return {
    ...decision,
    toolCalls,
  }
}

export function shouldPlanTutorToolDecision(input: PlannerInput) {
  const availableTools = getAvailableTutorTools(input)
  return availableTools.length > 0 && hasTutorPageActionIntent(input)
}

export type { PlannerDecision, PlannerInput }
