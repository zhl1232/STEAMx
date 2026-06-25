import type {
  TutorToolCall,
  TutorToolName,
  TutorToolReason,
} from '@/lib/ai/tutor/tool-calls'
import type { TutorSceneCapability } from '@/lib/ai/tutor/scene-capabilities'
import type { TutorContextType } from '@/lib/ai/tutor/types'
import type { ScratchBlockCategory, ScratchBlockHintItem } from '@/lib/courses/scratch-hints'

type BaseToolDefinition<TName extends TutorToolName> = {
  name: TName
  description: string
  whenToUse: string
  payloadShape: string
  requiredCapabilities: TutorSceneCapability[]
  availableWhen: (input: ToolAvailabilityInput) => boolean
  build: (input: ToolBuildInput) => Extract<TutorToolCall, { name: TName }> | null
}

export type ToolAvailabilityInput = {
  contextType: TutorContextType
  sceneCapabilities?: TutorSceneCapability[]
  lessonId?: number
  lessonStepIndex?: number
  lessonStepCount?: number
  stageIndex?: number
  scratchBlockKeywords?: string[]
  scratchBlockItems?: ScratchBlockHintItem[]
  scratchBlockStepItemCount?: number
  scratchBlockCategory?: ScratchBlockCategory
  scratchBlockTargetItemIndex?: number
}

export type ToolBuildInput = ToolAvailabilityInput & {
  reason: TutorToolReason
  stepIndex?: number
  targetItemIndex?: number
}

export type TutorPlannerToolSelection = {
  name: TutorToolName
  reason: TutorToolReason
  stepIndex?: number
  targetItemIndex?: number
}

export type TutorToolDefinition =
  | BaseToolDefinition<'pbl.focus_current_stage'>
  | BaseToolDefinition<'course.focus_lesson_step'>
  | BaseToolDefinition<'course.highlight_scratch_blocks'>

function clampIndex(value: number, max: number) {
  return Math.min(Math.max(Math.trunc(value), 0), max)
}

function clampStepIndex(stepIndex: number, stepCount?: number) {
  if (typeof stepCount === 'number' && stepCount > 0) {
    return clampIndex(stepIndex, stepCount - 1)
  }
  return Math.max(Math.trunc(stepIndex), 0)
}

function resolveScratchTargetItemIndex(input: {
  targetItemIndex?: number
  currentTargetItemIndex?: number
  itemCount: number
}) {
  if (input.itemCount <= 0) return undefined
  if (typeof input.targetItemIndex === 'number' && Number.isFinite(input.targetItemIndex)) {
    return clampIndex(input.targetItemIndex, input.itemCount - 1)
  }
  if (typeof input.currentTargetItemIndex === 'number' && Number.isFinite(input.currentTargetItemIndex)) {
    return clampIndex(input.currentTargetItemIndex, input.itemCount - 1)
  }
  return 0
}

export const TUTOR_TOOL_REGISTRY: TutorToolDefinition[] = [
  {
    name: 'pbl.focus_current_stage',
    description: '高亮并展开当前 PBL 阶段',
    whenToUse: '学生在 PBL 阶段里卡住、要下一步、或想看反馈',
    payloadShape: '{ stageIndex: number, reason: "stuck" | "next_step" | "review" }',
    requiredCapabilities: ['focusChallengeStage'],
    availableWhen: (input) =>
      input.contextType === 'challenge' &&
      typeof input.stageIndex === 'number' &&
      hasRequiredCapabilities(input.sceneCapabilities, ['focusChallengeStage']),
    build: (input) => {
      if (typeof input.stageIndex !== 'number') return null
      return {
        name: 'pbl.focus_current_stage',
        payload: {
          stageIndex: input.stageIndex,
          reason: input.reason,
        },
      }
    },
  },
  {
    name: 'course.focus_lesson_step',
    description: '聚焦当前技能课程步骤',
    whenToUse: '学生在技能课程里卡住、要下一步、或想检查当前步骤',
    payloadShape: '{ lessonId: number, stepIndex: number, reason: "stuck" | "next_step" | "review" }',
    requiredCapabilities: ['focusCourseLessonStep'],
    availableWhen: (input) =>
      input.contextType === 'course' &&
      typeof input.lessonId === 'number' &&
      hasRequiredCapabilities(input.sceneCapabilities, ['focusCourseLessonStep']),
    build: (input) => {
      if (typeof input.lessonId !== 'number') return null
      const requestedStepIndex =
        typeof input.stepIndex === 'number'
          ? input.stepIndex
          : typeof input.lessonStepIndex === 'number'
            ? input.lessonStepIndex
            : 0
      const stepIndex = clampStepIndex(requestedStepIndex, input.lessonStepCount)

      return {
        name: 'course.focus_lesson_step',
        payload: {
          lessonId: input.lessonId,
          stepIndex,
          reason: input.reason,
        },
      }
    },
  },
  {
    name: 'course.highlight_scratch_blocks',
    description: '在 Scratch 课时里高亮当前步骤要找的积木',
    whenToUse: '当前技能课程步骤含 Scratch 积木动作，需要打开分类并高亮一个具体积木',
    payloadShape:
      '{ lessonId: number, stepIndex: number, keywords: string[], items?: ScratchBlockHintItem[], targetItemIndex?: number, category?: ScratchBlockCategory, reason: "stuck" | "next_step" | "review" }',
    requiredCapabilities: ['focusCourseLessonStep'],
    availableWhen: (input) =>
      input.contextType === 'course' &&
      typeof input.lessonId === 'number' &&
      hasRequiredCapabilities(input.sceneCapabilities, ['focusCourseLessonStep']) &&
      ((input.scratchBlockItems?.length ?? 0) > 0 || (input.scratchBlockKeywords?.length ?? 0) > 0),
    build: (input) => {
      if (typeof input.lessonId !== 'number') return null
      const keywords = (input.scratchBlockKeywords ?? []).slice(0, 4)
      const items = (input.scratchBlockItems ?? []).slice(0, 4)
      if (keywords.length === 0 && items.length === 0) return null

      const requestedStepIndex =
        typeof input.stepIndex === 'number'
          ? input.stepIndex
          : typeof input.lessonStepIndex === 'number'
            ? input.lessonStepIndex
            : 0
      const stepIndex = clampStepIndex(requestedStepIndex, input.lessonStepCount)
      const itemCount = Math.max(keywords.length, items.length)
      const targetItemIndex = resolveScratchTargetItemIndex({
        targetItemIndex: input.targetItemIndex,
        currentTargetItemIndex: input.scratchBlockTargetItemIndex,
        itemCount,
      })

      return {
        name: 'course.highlight_scratch_blocks',
        payload: {
          lessonId: input.lessonId,
          stepIndex,
          keywords,
          items: items.length > 0 ? items : undefined,
          targetItemIndex,
          category: input.scratchBlockCategory,
          reason: input.reason,
        },
      }
    },
  },
]

function hasRequiredCapabilities(
  availableCapabilities: TutorSceneCapability[] | undefined,
  requiredCapabilities: TutorSceneCapability[],
) {
  if (requiredCapabilities.length === 0) return true
  if (!availableCapabilities || availableCapabilities.length === 0) return false
  const capabilitySet = new Set(availableCapabilities)
  return requiredCapabilities.every((capability) => capabilitySet.has(capability))
}

export function getAvailableTutorTools(input: ToolAvailabilityInput) {
  return TUTOR_TOOL_REGISTRY.filter((tool) => tool.availableWhen(input))
}

export function buildTutorToolCallsFromPlan(input: ToolAvailabilityInput & {
  selections: TutorPlannerToolSelection[]
  availableTools?: TutorToolDefinition[]
}) {
  const availableTools = input.availableTools ?? getAvailableTutorTools(input)
  const definitionMap = new Map(availableTools.map((tool) => [tool.name, tool]))
  const seen = new Set<TutorToolName>()
  const toolCalls: TutorToolCall[] = []

  for (const selection of input.selections.slice(0, 4)) {
    if (seen.has(selection.name)) continue
    const definition = definitionMap.get(selection.name)
    if (!definition) continue

    const toolCall = definition.build({
      ...input,
      reason: selection.reason,
      stepIndex: selection.stepIndex,
      targetItemIndex: selection.targetItemIndex,
    })
    if (!toolCall) continue

    seen.add(selection.name)
    toolCalls.push(toolCall)
  }

  return toolCalls
}
